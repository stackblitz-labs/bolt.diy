import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { AwsClient } from 'aws4fetch';
import { withSecurity } from '~/lib/security';

/**
 * Validate AWS Amplify credentials
 * Makes a test API call to list apps to verify credentials are valid
 */
async function amplifyValidateAction({ request }: ActionFunctionArgs) {
  try {
    const body = (await request.json()) as {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    };

    const { accessKeyId, secretAccessKey, region } = body;

    if (!accessKeyId || !secretAccessKey || !region) {
      return json({ valid: false, error: 'Missing required credentials' }, { status: 400 });
    }

    // Create AWS client for SigV4 signing
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: 'amplify',
    });

    const amplifyBaseUrl = `https://amplify.${region}.amazonaws.com`;

    // Test credentials by listing apps (lightweight operation)
    const response = await aws.fetch(`${amplifyBaseUrl}/apps`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = (await response.json()) as any;
      return json({
        valid: false,
        error: errorData.message || `Authentication failed: ${response.status}`,
      });
    }

    return json({ valid: true });
  } catch (error) {
    console.error('Amplify validation error:', error);
    return json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    });
  }
}

export const action = withSecurity(amplifyValidateAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
