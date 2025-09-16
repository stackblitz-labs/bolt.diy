import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

// Very small proxy to access local services (LM Studio, Ollama, Docker Model Runner)
// from the browser without running into CORS. Restricted to localhost-style hosts.

const ALLOWED_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  'host.docker.internal',
  'model-runner.docker.internal',
]);

const CORS_HEADERS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,authorization',
  'Access-Control-Max-Age': '86400',
};

function isAllowed(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return (url.protocol === 'http:' || url.protocol === 'https:') && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (!target || !isAllowed(target)) {
    return json({ error: 'Invalid or disallowed target URL' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const init: RequestInit = {
      method: request.method,
      headers: { 'Content-Type': request.headers.get('Content-Type') || 'application/json' },
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      // @ts-ignore - duplex is required by some runtimes for streaming bodies
      init.duplex = 'half';
    }

    const resp = await fetch(target, init);

    const headers = new Headers(CORS_HEADERS);
    // Pass through content type if present
    const contentType = resp.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    });
  } catch (err) {
    return json({ error: 'Proxy request failed', message: err instanceof Error ? err.message : String(err) }, {
      status: 502,
      headers: CORS_HEADERS,
    });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return handle(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handle(request);
}
