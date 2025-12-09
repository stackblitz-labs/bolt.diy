import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { AwsClient } from 'aws4fetch';
import JSZip from 'jszip';
import type { DeployRequestBody, DeployResponse } from '~/types/deployment';

const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Deploy to AWS Amplify
 *
 * Flow:
 * 1. Get or create branch (branch = chatId for platform-managed)
 * 2. Create deployment to get presigned S3 URL
 * 3. Create ZIP archive of files using jszip
 * 4. Upload ZIP to S3
 * 5. Start deployment
 * 6. Return deploymentId for status polling
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;

  try {
    const body = (await request.json()) as DeployRequestBody;
    const { files, chatId, authMode = 'platform-managed' } = body;

    // Determine credentials
    let accessKeyId: string;
    let secretAccessKey: string;
    let region: string;
    let appId: string;

    if (authMode === 'user-token') {
      if (!body.accessKeyId || !body.secretAccessKey || !body.region) {
        return json({ error: 'Missing AWS credentials' }, { status: 401 });
      }

      accessKeyId = body.accessKeyId;
      secretAccessKey = body.secretAccessKey;
      region = body.region;

      // User must provide their own app ID or we create one
      appId = body.projectId || '';
    } else {
      if (!env.AMPLIFY_ACCESS_KEY_ID || !env.AMPLIFY_SECRET_ACCESS_KEY) {
        return json({ error: 'Platform AWS credentials not configured' }, { status: 500 });
      }

      accessKeyId = env.AMPLIFY_ACCESS_KEY_ID;
      secretAccessKey = env.AMPLIFY_SECRET_ACCESS_KEY;
      region = env.AMPLIFY_REGION || 'us-east-1';
      appId = env.AMPLIFY_APP_ID || '';
    }

    if (!appId) {
      return json({ error: 'No Amplify app configured' }, { status: 400 });
    }

    // Create AWS client for SigV4 signing
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
      service: 'amplify',
    });

    const amplifyBaseUrl = `https://amplify.${region}.amazonaws.com`;
    const branchName = chatId.replace(/[^a-zA-Z0-9-]/g, '-').substring(0, 50);

    // Step 1: Ensure branch exists
    try {
      const getBranchResponse = await aws.fetch(`${amplifyBaseUrl}/apps/${appId}/branches/${branchName}`, {
        method: 'GET',
      });

      if (!getBranchResponse.ok && getBranchResponse.status !== 404) {
        throw new Error(`Failed to check branch: ${getBranchResponse.status}`);
      }

      if (getBranchResponse.status === 404) {
        // Create branch
        const createBranchResponse = await aws.fetch(`${amplifyBaseUrl}/apps/${appId}/branches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branchName,
            stage: 'PRODUCTION',
            enableAutoBuild: false,
          }),
        });

        if (!createBranchResponse.ok && createBranchResponse.status !== 409) {
          const errorData = (await createBranchResponse.json()) as any;
          throw new Error(`Failed to create branch: ${errorData.message || createBranchResponse.status}`);
        }
      }
    } catch (error) {
      console.error('Branch setup error:', error);
      return json(
        {
          error: `Failed to setup branch: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        { status: 500 },
      );
    }

    // Step 2: Create deployment
    const createDeployResponse = await aws.fetch(`${amplifyBaseUrl}/apps/${appId}/branches/${branchName}/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!createDeployResponse.ok) {
      const errorData = (await createDeployResponse.json()) as any;
      return json(
        {
          error: `Failed to create deployment: ${errorData.message || createDeployResponse.status}`,
        },
        { status: 500 },
      );
    }

    const deploymentData = (await createDeployResponse.json()) as {
      jobId: string;
      zipUploadUrl: string;
    };

    // Step 3: Create ZIP archive
    const zip = new JSZip();

    for (const [filePath, content] of Object.entries(files)) {
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      zip.file(normalizedPath, content);
    }

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (zipBlob.size > MAX_ZIP_SIZE) {
      return json(
        {
          error: `Deployment package too large. Maximum is 50MB, got ${Math.round(zipBlob.size / 1024 / 1024)}MB`,
        },
        { status: 400 },
      );
    }

    // Step 4: Upload ZIP to S3 presigned URL
    const uploadResponse = await fetch(deploymentData.zipUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
      },
      body: zipBlob,
    });

    if (!uploadResponse.ok) {
      return json(
        {
          error: `Failed to upload deployment package: ${uploadResponse.status}`,
        },
        { status: 500 },
      );
    }

    // Step 5: Start deployment
    const startDeployResponse = await aws.fetch(
      `${amplifyBaseUrl}/apps/${appId}/branches/${branchName}/deployments/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: deploymentData.jobId }),
      },
    );

    if (!startDeployResponse.ok) {
      const errorData = (await startDeployResponse.json()) as any;
      return json(
        {
          error: `Failed to start deployment: ${errorData.message || startDeployResponse.status}`,
        },
        { status: 500 },
      );
    }

    const deploymentId = `amp-${chatId}-${Date.now()}`;
    const deploymentUrl = `https://${branchName}.${appId}.amplifyapp.com`;

    // TODO: Store deployment record in database

    return json({
      success: true,
      deploymentId,
      status: 'building', // Amplify builds take time
      url: deploymentUrl,
      externalId: deploymentData.jobId,
    } as DeployResponse & { externalId: string });
  } catch (error) {
    console.error('Amplify deploy error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Deployment failed',
      },
      { status: 500 },
    );
  }
}
