import type { ActionFunctionArgs } from 'react-router';

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Add proper type assertion for the request body
    const body = (await request.json()) as { projectId?: string; token?: string };
    const { projectId, token } = body;

    if (!projectId || !token) {
      return Response.json({ error: 'Project ID and token are required' }, { status: 400 });
    }

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `Failed to fetch API keys: ${response.statusText}` }, { status: response.status });
    }

    const apiKeys = await response.json();

    return Response.json({ apiKeys });
  } catch (error) {
    console.error('Error fetching project API keys:', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error occurred' }, { status: 500 });
  }
}
