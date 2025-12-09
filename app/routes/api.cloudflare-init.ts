import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const envToken = process.env.CLOUDFLARE_API_TOKEN;
  const envAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!envToken || !envAccountId) {
    return json({ success: false, hasEnvCredentials: false });
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${envAccountId}`, {
      headers: {
        Authorization: `Bearer ${envToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Cloudflare: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return json({
      success: true,
      user: {
        id: data.result.id,
        name: data.result.name,
      },
      accountId: envAccountId,
    });
  } catch (error) {
    console.error('Error initializing Cloudflare connection:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
