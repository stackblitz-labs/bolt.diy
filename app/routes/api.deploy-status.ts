import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import type { DeploymentStatusResponse, DeploymentPlatform } from '~/types/deployment';

/**
 * Unified deployment status polling endpoint
 *
 * GET /api/deploy-status?platform=amplify&deploymentId=xxx&externalId=yyy
 *
 * This endpoint is polled by clients every 2-3 seconds to check deployment status.
 * It proxies requests to the appropriate platform API.
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') as DeploymentPlatform | null;
  const deploymentId = url.searchParams.get('deploymentId');
  const externalId = url.searchParams.get('externalId');

  if (!platform || !deploymentId) {
    return json({ error: 'Missing platform or deploymentId' }, { status: 400 });
  }

  try {
    let status: DeploymentStatusResponse;

    switch (platform) {
      case 'amplify':
        status = await getAmplifyStatus(context.cloudflare.env, deploymentId, externalId);
        break;
      case 'cloudflare':
        status = await getCloudflareStatus(context.cloudflare.env, deploymentId, externalId);
        break;
      default:
        return json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    return json(status);
  } catch (error) {
    console.error('Deploy status error:', error);
    return json(
      {
        deploymentId,
        platform,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to get deployment status',
      } as DeploymentStatusResponse,
      { status: 500 },
    );
  }
}

async function getAmplifyStatus(
  env: Env,
  deploymentId: string,
  externalId?: string | null,
): Promise<DeploymentStatusResponse> {
  // TODO: Implement in Phase 3
  // Use aws4fetch to sign request to Amplify GetJob API
  throw new Error('Amplify status not yet implemented');
}

async function getCloudflareStatus(
  env: Env,
  deploymentId: string,
  externalId?: string | null,
): Promise<DeploymentStatusResponse> {
  // TODO: Implement in Phase 2
  // Query Cloudflare Workers deployment status
  throw new Error('Cloudflare status not yet implemented');
}

