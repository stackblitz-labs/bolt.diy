import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as { token?: string; accountId?: string };
    const { token, accountId } = body;

    if (!token || !accountId) {
      return json({ error: 'Token and accountId are required' }, { status: 400 });
    }

    // Verify token by fetching account details server-side
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return json({
      success: true,
      user: {
        id: data.result.id,
        name: data.result.name,
      },
      accountId,
    });
  } catch (error) {
    console.error('Cloudflare validation error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
