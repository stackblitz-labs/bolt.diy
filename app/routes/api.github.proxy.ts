import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

interface GitHubErrorResponse {
  error?: string;
  error_description?: string;
}

interface GitHubResponse extends GitHubErrorResponse {
  [key: string]: unknown;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const targetEndpoint = url.searchParams.get('endpoint');
  const token = request.headers.get('Authorization');

  if (!targetEndpoint) {
    return new Response('Missing required parameters', { status: 400 });
  }

  // Determine if this is a GitHub API request or OAuth request
  const isApiRequest = targetEndpoint.startsWith('/user') || targetEndpoint.startsWith('/repos');
  const baseUrl = isApiRequest ? 'https://api.github.com' : 'https://github.com';

  /*
   * For API requests, we need the token but not client_id
   * For OAuth requests, we need client_id
   */
  if (isApiRequest && !token) {
    return new Response('Missing Authorization header', { status: 401 });
  }

  const githubUrl = `${baseUrl}${targetEndpoint}`;
  const params = new URLSearchParams();

  // Forward all query parameters to GitHub
  url.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      params.append(key, value);
    }
  });

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = token;
    }

    const response = await fetch(`${githubUrl}${params.toString() ? `?${params}` : ''}`, {
      method: 'GET',
      headers,
    });

    const data = (await response.json()) as GitHubResponse;

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to proxy request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const targetEndpoint = url.searchParams.get('endpoint');
  const clientId = url.searchParams.get('client_id');
  const token = request.headers.get('Authorization');

  if (!targetEndpoint) {
    return new Response('Missing required parameters', { status: 400 });
  }

  // Determine if this is a GitHub API request or OAuth request
  const isApiRequest = targetEndpoint.startsWith('/user') || targetEndpoint.startsWith('/repos');
  const baseUrl = isApiRequest ? 'https://api.github.com' : 'https://github.com';

  /*
   * For API requests, we need the token but not client_id
   * For OAuth requests, we need client_id
   */
  if (isApiRequest && !token) {
    return new Response('Missing Authorization header', { status: 401 });
  }

  if (!isApiRequest && !clientId) {
    return new Response('Missing client_id', { status: 400 });
  }

  const githubUrl = `${baseUrl}${targetEndpoint}`;
  const params = new URLSearchParams();

  // Forward all query parameters to GitHub
  url.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      params.append(key, value);
    }
  });

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (token) {
      headers.Authorization = token;
    }

    const response = await fetch(`${githubUrl}${params.toString() ? `?${params}` : ''}`, {
      method: request.method,
      headers,
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    const data = (await response.json()) as GitHubResponse;

    // Check if the response is an error
    if (data.error) {
      return new Response(JSON.stringify(data), {
        status: data.error === 'authorization_pending' ? 202 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Failed to proxy request',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}

// Handle preflight requests
export async function options() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
