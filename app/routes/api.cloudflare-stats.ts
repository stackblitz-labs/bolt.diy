import type { ActionFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const envToken = process.env.CLOUDFLARE_API_TOKEN;
  const envAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!envToken || !envAccountId) {
    return json({ success: false, error: 'Cloudflare credentials not configured' }, { status: 400 });
  }

  try {
    const workersResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${envAccountId}/workers/scripts`, {
      headers: {
        Authorization: `Bearer ${envToken}`,
      },
    });

    if (!workersResponse.ok) {
      throw new Error(`Failed to fetch workers: ${workersResponse.status}`);
    }

    const workersData = (await workersResponse.json()) as any;
    const workers = workersData.result || [];

    return json({
      success: true,
      stats: {
        workers,
        totalWorkers: workers.length,
      },
    });
  } catch (error) {
    console.error('Cloudflare API Error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

