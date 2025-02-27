import type { LoaderFunctionArgs } from '@remix-run/node';

/**
 * Proxy API for LM Studio to handle CORS issues
 * This route forwards requests to the LM Studio server and adds proper CORS headers
 * Accessible at /api/proxy/lmstudio
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const loader = async ({ request, params, context }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  console.log('LM Studio proxy request received for URL:', targetUrl);

  if (!targetUrl) {
    console.error('LM Studio proxy error: Missing target URL parameter');
    return new Response(JSON.stringify({ error: 'Missing target URL parameter' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Forward the request to LM Studio server
    console.log('LM Studio proxy forwarding request to:', targetUrl);
    console.log('LM Studio proxy request method:', request.method);

    const headers = {
      'Content-Type': 'application/json',

      // Forward authorization header if present
      ...(request.headers.get('Authorization') ? { Authorization: request.headers.get('Authorization') || '' } : {}),
    };

    console.log('LM Studio proxy request headers:', headers);

    // Only read the body for non-GET requests and clone the request to avoid reading it twice
    let requestBody: string | undefined;

    if (request.method !== 'GET') {
      const clonedRequest = request.clone();
      requestBody = await clonedRequest.text();
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,

      // Forward the request body for non-GET requests
      ...(requestBody ? { body: requestBody } : {}),
    });

    console.log('LM Studio proxy response status:', response.status);

    // Check if response is OK
    if (!response.ok) {
      console.error('LM Studio server returned error status:', response.status);
      return new Response(
        JSON.stringify({
          error: `LM Studio server returned error status: ${response.status}`,
          status: response.status,
        }),
        {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        },
      );
    }

    // Get the response data
    try {
      const data = await response.json();
      console.log('LM Studio proxy response data:', JSON.stringify(data).substring(0, 500) + '...');

      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        console.log('LM Studio proxy found models:', data.data.length);

        // Log the first model for debugging
        if (data.data.length > 0) {
          console.log('First model example:', JSON.stringify(data.data[0]));
        }
      } else {
        console.warn(
          'LM Studio proxy response does not contain expected data structure:',
          Object.keys(data || {}).join(', '),
        );
      }

      // Return the response with proper headers
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    } catch (jsonError) {
      console.error('Error parsing JSON from LM Studio response:', jsonError);

      // If we can't parse JSON, return the raw text
      const textData = await response.text();

      return new Response(
        JSON.stringify({
          error: 'Failed to parse JSON from LM Studio response',
          rawResponse: textData.substring(0, 1000), // Limit the size of the raw response
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        },
      );
    }
  } catch (error) {
    console.error('Error proxying request to LM Studio:', error);

    let errorMessage = 'Failed to connect to LM Studio server';
    let errorDetails = '';

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
    } else if (typeof error === 'string') {
      errorDetails = error;
    } else {
      errorDetails = String(error);
    }

    console.error('Error details:', errorDetails);

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails.substring(0, 500), // Limit the size of the error details
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      },
    );
  }
};

/**
 * Handle POST requests to the proxy
 */

export const action = async ({ request, params, context }: LoaderFunctionArgs) => {
  // Reuse the same logic as the loader
  return loader({ request, params, context });
};

// Handle OPTIONS requests for CORS preflight
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const options = async ({ request, params, context }: LoaderFunctionArgs) => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
