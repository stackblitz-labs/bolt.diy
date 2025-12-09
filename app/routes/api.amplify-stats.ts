import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { AwsClient } from 'aws4fetch';
import { withSecurity } from '~/lib/security';

/**
 * Fetch AWS Amplify statistics
 * Returns list of apps for the authenticated account
 */
async function amplifyStatsAction({ request }: ActionFunctionArgs) {
  try {
    const body = (await request.json()) as {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };

    const { accessKeyId, secretAccessKey, region } = body;

    if (!accessKeyId || !secretAccessKey || !region) {
      return json({ apps: [], error: 'Missing required credentials' }, { status: 400 });
    }

    // Create AWS client for SigV4 signing
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: 'amplify',
    });

    const amplifyBaseUrl = `https://amplify.${region}.amazonaws.com`;

    // Fetch list of apps
    const response = await aws.fetch(`${amplifyBaseUrl}/apps`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = (await response.json()) as any;
      return json({
        apps: [],
        error: errorData.message || `Failed to fetch apps: ${response.status}`,
      });
    }

    const data = (await response.json()) as any;

    return json({ apps: data.apps || [] });
  } catch (error) {
    console.error('Amplify stats error:', error);
    return json({
      apps: [],
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
    });
  }
}

export const action = withSecurity(amplifyStatsAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
