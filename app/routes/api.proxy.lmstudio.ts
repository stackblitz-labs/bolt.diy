import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

// Allowed headers to forward to the target server
const ALLOW_HEADERS = [
  'accept-encoding',
  'accept-language',
  'accept',
  'access-control-allow-origin',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'dnt',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-authorization',
  'x-http-method-override',
  'x-requested-with',
];

// Headers to expose from the target server's response
const EXPOSE_HEADERS = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
];

// Handle all HTTP methods
export async function action({ request }: ActionFunctionArgs) {
  return handleProxyRequest(request);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return handleProxyRequest(request);
}

async function handleProxyRequest(request: Request) {
  try {
    // Handle CORS preflight request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
          'Access-Control-Allow-Headers': ALLOW_HEADERS.join(', '),
          'Access-Control-Expose-Headers': EXPOSE_HEADERS.join(', '),
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Get URL parameters from the request
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const baseUrl = url.searchParams.get('baseUrl');

    if (!path || !baseUrl) {
      return json({ error: 'Missing required parameters: path and baseUrl' }, { status: 400 });
    }

    // Construct the target URL
    const targetURL = `${baseUrl}${path}`;
    console.log('Proxying request to LM Studio at:', targetURL);

    // Filter and prepare headers
    const headers = new Headers();

    // Only forward allowed headers
    for (const header of ALLOW_HEADERS) {
      if (request.headers.has(header)) {
        headers.set(header, request.headers.get(header)!);
      }
    }

    // Ensure content-type is set for POST requests
    if (request.method === 'POST' && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    console.log('Request headers:', Object.fromEntries(headers.entries()));

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      redirect: 'follow',
    };

    // Add body for non-GET/HEAD requests
    if (!['GET', 'HEAD'].includes(request.method)) {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    // Forward the request to the target URL
    const response = await fetch(targetURL, fetchOptions);

    console.log('Response status:', response.status);

    // Create response headers
    const responseHeaders = new Headers();

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
    responseHeaders.set('Access-Control-Allow-Headers', ALLOW_HEADERS.join(', '));
    responseHeaders.set('Access-Control-Expose-Headers', EXPOSE_HEADERS.join(', '));

    // Copy exposed headers from the target response
    for (const header of EXPOSE_HEADERS) {
      // Skip content-length as we'll use the original response's content-length
      if (header === 'content-length') {
        continue;
      }

      if (response.headers.has(header)) {
        responseHeaders.set(header, response.headers.get(header)!);
      }
    }

    // Set content type if it's present in the response
    if (response.headers.has('content-type')) {
      responseHeaders.set('content-type', response.headers.get('content-type')!);
    } else {
      // Default to JSON if not specified
      responseHeaders.set('content-type', 'application/json');
    }

    console.log('Response headers:', Object.fromEntries(responseHeaders.entries()));

    // Get the response body
    const body = await response.arrayBuffer();

    // Return the response
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('LM Studio proxy error:', error);
    return json(
      {
        error: 'LM Studio proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
