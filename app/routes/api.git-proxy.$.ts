import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';

const GIT_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);
const METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'];
const FORWARD_HEADERS = ['accept', 'authorization', 'content-type', 'git-protocol', 'range', 'x-requested-with'];
const EXPOSE_HEADERS = ['content-type', 'etag', 'www-authenticate'];
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function isAllowedTarget(url: URL, method: string) {
  if (
    url.protocol !== 'https:' ||
    !GIT_HOSTS.has(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return false;
  }

  if (method === 'POST') {
    return /\/(git-upload-pack|git-receive-pack)$/.test(url.pathname);
  }

  return (
    url.pathname.endsWith('/info/refs') &&
    ['git-upload-pack', 'git-receive-pack'].includes(url.searchParams.get('service') || '')
  );
}

export async function action({ request, params }: ActionFunctionArgs) {
  return handleProxyRequest(request, params['*']);
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return handleProxyRequest(request, params['*']);
}

async function handleProxyRequest(request: Request, path: string | undefined) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');

  if (origin && origin !== requestUrl.origin) {
    return Response.json({ error: 'Cross-origin Git proxy requests are not allowed' }, { status: 403 });
  }

  if (!METHODS.includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: METHODS.join(', ') } });
  }

  if (!path) {
    return Response.json({ error: 'Invalid proxy URL format' }, { status: 400 });
  }

  let target: URL;

  try {
    target = new URL('https://' + path + requestUrl.search);
  } catch {
    return Response.json({ error: 'Invalid proxy URL format' }, { status: 400 });
  }

  // Preflight checks the intended method and destination before allowing headers.
  const method =
    request.method === 'OPTIONS' ? request.headers.get('Access-Control-Request-Method') || 'GET' : request.method;

  if (!['GET', 'HEAD', 'POST'].includes(method) || !isAllowedTarget(target, method)) {
    return Response.json({ error: 'Only Git requests to supported Git hosts are allowed' }, { status: 403 });
  }

  const responseHeaders = new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    Vary: 'Origin',
  });

  if (origin) {
    responseHeaders.set('Access-Control-Allow-Origin', requestUrl.origin);
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', FORWARD_HEADERS.join(', '));
    responseHeaders.set('Access-Control-Expose-Headers', EXPOSE_HEADERS.join(', '));
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  const headers = new Headers({ 'User-Agent': 'git/bolt.diy' });

  for (const header of FORWARD_HEADERS) {
    const value = request.headers.get(header);

    if (value) {
      headers.set(header, value);
    }
  }

  const fetchOptions: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
    signal: request.signal,
  };

  if (method === 'POST') {
    fetchOptions.body = request.body;
    fetchOptions.duplex = 'half';
  }

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const response = await fetch(target, fetchOptions);

      if (REDIRECTS.has(response.status)) {
        const location = response.headers.get('Location');
        await response.body?.cancel();

        if (!location || method === 'POST' || redirects === MAX_REDIRECTS) {
          return Response.json({ error: 'Unsupported Git proxy redirect' }, { status: 502 });
        }

        const next = new URL(location, target);

        // Keep credentials on the original trusted host and revalidate every hop.
        if (next.origin !== target.origin || !isAllowedTarget(next, method)) {
          return Response.json({ error: 'Git proxy redirect destination is not allowed' }, { status: 403 });
        }

        target = next;
        continue;
      }

      for (const header of EXPOSE_HEADERS) {
        const value = response.headers.get(header);

        if (value) {
          responseHeaders.set(header, value);
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }
  } catch {
    return Response.json({ error: 'Git proxy request failed' }, { status: 502 });
  }

  return Response.json({ error: 'Too many Git proxy redirects' }, { status: 502 });
}
