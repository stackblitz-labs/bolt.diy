# Deployment Feature Implementation Plan

> **Version:** 1.0  
> **Last Updated:** 2025-01-07  
> **Status:** Ready for Implementation

This document provides step-by-step implementation instructions for adding AWS Amplify and Cloudflare Workers Static Assets deployment capabilities.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
3. [Phase 2: Cloudflare Workers Assets Integration](#phase-2-cloudflare-workers-assets-integration)
4. [Phase 3: AWS Amplify Integration](#phase-3-aws-amplify-integration)
5. [Phase 4: UI Integration](#phase-4-ui-integration)
6. [Phase 5: User Token Mode](#phase-5-user-token-mode)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)

---

## Prerequisites

### Dependencies to Install

```bash
pnpm add aws4fetch
```

> **Note:** `jszip` is already in dependencies. Do NOT add `archiver` (Node-only, not Workers-compatible).

### Environment Variables Required

Add to `.env.example` and configure in `.env.local`:

```env
# Platform-managed deployment credentials
# AWS Amplify (use least-privilege IAM policy)
AMPLIFY_ACCESS_KEY_ID=
AMPLIFY_SECRET_ACCESS_KEY=
AMPLIFY_REGION=us-east-1
AMPLIFY_APP_ID=           # Shared app for platform-managed deploys

# Cloudflare Workers (scope: Workers Scripts:Edit, Account:Read)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_WORKER_NAME=   # Base worker for static assets
```

---

## Phase 1: Core Infrastructure

**Estimated Time:** 2-4 hours

### Step 1.1: Create Deployment Types

Create `app/types/deployment.ts`:

```typescript
/**
 * Deployment type definitions
 * Shared across all deployment platforms
 */

export type DeploymentPlatform = 'amplify' | 'cloudflare' | 'netlify' | 'vercel';
export type AuthMode = 'user-token' | 'platform-managed';
export type DeploymentStatus = 'pending' | 'building' | 'uploading' | 'ready' | 'error';

/**
 * Configuration for initiating a deployment
 */
export interface DeploymentConfig {
  platform: DeploymentPlatform;
  authMode: AuthMode;
  files: Record<string, string>; // path -> content
  projectName: string;
  chatId: string;
  framework?: string;
}

/**
 * Result returned after initiating a deployment
 */
export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url?: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  error?: string;
}

/**
 * Status response from polling endpoint
 */
export interface DeploymentStatusResponse {
  deploymentId: string;
  platform: DeploymentPlatform;
  status: DeploymentStatus;
  url?: string;
  error?: string;
  progress?: number; // 0-100
  startedAt?: string;
  completedAt?: string;
}

/**
 * Base platform connection interface
 */
export interface PlatformConnection {
  token: string;
  user?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
}

/**
 * AWS Amplify connection with IAM credentials
 */
export interface AmplifyConnection extends PlatformConnection {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  appId?: string; // Existing app to deploy to
}

/**
 * Cloudflare Workers connection
 */
export interface CloudflareConnection extends PlatformConnection {
  accountId: string;
  workerName?: string; // Existing worker to update
}

/**
 * Database record for tracking deployments
 */
export interface DeploymentRecord {
  id: string;
  userId?: string;
  chatId: string;
  platform: DeploymentPlatform;
  authMode: AuthMode;
  externalId?: string; // Platform's deployment/job ID
  externalProjectId?: string; // Platform's project/app/branch ID
  status: DeploymentStatus;
  url?: string;
  error?: string;
  fileCount?: number;
  totalSizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // For TTL cleanup
}

/**
 * Cloudflare Workers Assets upload session
 */
export interface CloudflareUploadSession {
  jwt: string;
  buckets: string[][]; // Groups of file hashes to upload together
}

/**
 * Cloudflare asset manifest entry
 */
export interface CloudflareAssetManifest {
  [path: string]: string; // path -> SHA-256 hash
}

/**
 * AWS Amplify deployment response
 */
export interface AmplifyDeploymentResponse {
  jobId: string;
  zipUploadUrl: string;
  appId: string;
  branchName: string;
}

/**
 * API request body for deploy endpoints
 */
export interface DeployRequestBody {
  files: Record<string, string>;
  chatId: string;
  projectId?: string; // For existing deployments
  authMode?: AuthMode;
  // User-token mode fields
  token?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  accountId?: string;
}

/**
 * API response from deploy endpoints
 */
export interface DeployResponse {
  success: boolean;
  deploymentId: string;
  status: DeploymentStatus;
  url?: string;
  error?: string;
}
```

### Step 1.2: Create Deploy Status Endpoint

Create `app/routes/api.deploy-status.ts`:

```typescript
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
    return json({
      deploymentId,
      platform,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to get deployment status',
    } as DeploymentStatusResponse);
  }
}

async function getAmplifyStatus(
  env: Env,
  deploymentId: string,
  externalId?: string | null
): Promise<DeploymentStatusResponse> {
  // TODO: Implement in Phase 3
  // Use aws4fetch to sign request to Amplify GetJob API
  throw new Error('Amplify status not yet implemented');
}

async function getCloudflareStatus(
  env: Env,
  deploymentId: string,
  externalId?: string | null
): Promise<DeploymentStatusResponse> {
  // TODO: Implement in Phase 2
  // Query Cloudflare Workers deployment status
  throw new Error('Cloudflare status not yet implemented');
}
```

### Step 1.3: Create Database Migration

Create `supabase/migrations/YYYYMMDDHHMMSS_deployments.sql`:

```sql
-- Track deployments for status, cleanup, and analytics
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('amplify', 'cloudflare', 'netlify', 'vercel')),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('user-token', 'platform-managed')),
  external_id TEXT,           -- Platform's deployment/job ID
  external_project_id TEXT,   -- Platform's project/app/branch ID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'uploading', 'ready', 'error')),
  url TEXT,
  error TEXT,
  file_count INTEGER,
  total_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ      -- For TTL cleanup of platform-managed deployments
);

-- Indexes for common queries
CREATE INDEX idx_deployments_user ON deployments(user_id);
CREATE INDEX idx_deployments_chat ON deployments(chat_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_platform ON deployments(platform);
CREATE INDEX idx_deployments_expires ON deployments(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_deployments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_deployments_updated_at();

-- RLS policies
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Users can read their own deployments
CREATE POLICY "Users can read own deployments"
  ON deployments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own deployments
CREATE POLICY "Users can insert own deployments"
  ON deployments FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own deployments
CREATE POLICY "Users can update own deployments"
  ON deployments FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do anything (for cleanup jobs)
CREATE POLICY "Service role full access"
  ON deployments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### Step 1.4: Update Environment Types

Add to `worker-configuration.d.ts`:

```typescript
interface Env {
  // ... existing env vars
  
  // AWS Amplify
  AMPLIFY_ACCESS_KEY_ID?: string;
  AMPLIFY_SECRET_ACCESS_KEY?: string;
  AMPLIFY_REGION?: string;
  AMPLIFY_APP_ID?: string;
  
  // Cloudflare Workers
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_WORKER_NAME?: string;
}
```

---

## Phase 2: Cloudflare Workers Assets Integration

**Estimated Time:** 1-2 days

### Step 2.1: Create Cloudflare Store

Create `app/lib/stores/cloudflare.ts`:

```typescript
import { atom } from 'nanostores';
import type { CloudflareConnection } from '~/types/deployment';
import { logStore } from './logs';
import { toast } from 'react-toastify';

// Initialize with stored connection or environment variable
const storedConnection = typeof window !== 'undefined' 
  ? localStorage.getItem('cloudflare_connection') 
  : null;

const envToken = typeof window !== 'undefined' 
  ? import.meta.env.VITE_CLOUDFLARE_API_TOKEN 
  : '';
const envAccountId = typeof window !== 'undefined' 
  ? import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID 
  : '';

const initialConnection: CloudflareConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: null,
      token: envToken || '',
      accountId: envAccountId || '',
    };

export const cloudflareConnection = atom<CloudflareConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

export const updateCloudflareConnection = (updates: Partial<CloudflareConnection>) => {
  const currentState = cloudflareConnection.get();
  const newState = { ...currentState, ...updates };
  cloudflareConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('cloudflare_connection', JSON.stringify(newState));
  }
};

export async function initializeCloudflareConnection() {
  const currentState = cloudflareConnection.get();

  if (currentState.user || !envToken || !envAccountId) {
    return;
  }

  try {
    isConnecting.set(true);

    // Verify token by fetching account details
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${envAccountId}`,
      {
        headers: {
          Authorization: `Bearer ${envToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to connect to Cloudflare: ${response.statusText}`);
    }

    const data = await response.json() as any;

    updateCloudflareConnection({
      user: {
        id: data.result.id,
        name: data.result.name,
      },
      token: envToken,
      accountId: envAccountId,
    });

    await fetchCloudflareStats(envToken, envAccountId);
  } catch (error) {
    console.error('Error initializing Cloudflare connection:', error);
    logStore.logError('Failed to initialize Cloudflare connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export async function fetchCloudflareStats(token: string, accountId: string) {
  try {
    isFetchingStats.set(true);

    // Fetch Workers list
    const workersResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!workersResponse.ok) {
      throw new Error(`Failed to fetch workers: ${workersResponse.status}`);
    }

    const workersData = await workersResponse.json() as any;
    const workers = workersData.result || [];

    const currentState = cloudflareConnection.get();
    updateCloudflareConnection({
      ...currentState,
      stats: {
        workers,
        totalWorkers: workers.length,
      },
    });
  } catch (error) {
    console.error('Cloudflare API Error:', error);
    logStore.logError('Failed to fetch Cloudflare stats', { error });
    toast.error('Failed to fetch Cloudflare statistics');
  } finally {
    isFetchingStats.set(false);
  }
}
```

### Step 2.2: Create Cloudflare Deploy API Route

Create `app/routes/api.cloudflare-deploy.ts`:

```typescript
import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import type { 
  DeployRequestBody, 
  DeployResponse,
  CloudflareUploadSession,
  CloudflareAssetManifest 
} from '~/types/deployment';

const MAX_BATCH_SIZE = 40 * 1024 * 1024; // 40MB per batch
const MAX_FILES_PER_BATCH = 2000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
const MAX_TOTAL_FILES = 20000;

/**
 * Deploy to Cloudflare Workers Static Assets
 * 
 * Flow:
 * 1. Create upload session with manifest
 * 2. Check which files need uploading (deduplication)
 * 3. Upload files in batches (max 40MB per batch)
 * 4. Complete the upload session
 * 5. Return deploymentId for status polling
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const env = context.cloudflare.env;
  
  try {
    const body = await request.json() as DeployRequestBody & { token?: string; accountId?: string };
    const { files, chatId, authMode = 'platform-managed' } = body;

    // Determine credentials based on auth mode
    let token: string;
    let accountId: string;
    let workerName: string;

    if (authMode === 'user-token') {
      if (!body.token || !body.accountId) {
        return json({ error: 'Missing Cloudflare credentials' }, { status: 401 });
      }
      token = body.token;
      accountId = body.accountId;
      workerName = `huskit-${chatId}`;
    } else {
      // Platform-managed mode
      if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        return json({ error: 'Platform Cloudflare credentials not configured' }, { status: 500 });
      }
      token = env.CLOUDFLARE_API_TOKEN;
      accountId = env.CLOUDFLARE_ACCOUNT_ID;
      workerName = env.CLOUDFLARE_WORKER_NAME || 'huskit-sites';
    }

    // Validate file limits
    const fileEntries = Object.entries(files);
    if (fileEntries.length > MAX_TOTAL_FILES) {
      return json({ 
        error: `Too many files. Maximum is ${MAX_TOTAL_FILES}, got ${fileEntries.length}` 
      }, { status: 400 });
    }

    // Calculate file hashes and build manifest
    const manifest: CloudflareAssetManifest = {};
    const fileContents: Map<string, { path: string; content: string; size: number }> = new Map();

    for (const [filePath, content] of fileEntries) {
      const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
      const contentBytes = new TextEncoder().encode(content);
      
      if (contentBytes.length > MAX_FILE_SIZE) {
        return json({ 
          error: `File ${filePath} exceeds maximum size of 25MB` 
        }, { status: 400 });
      }

      // Calculate SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', contentBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      manifest[normalizedPath] = hashHex;
      fileContents.set(hashHex, { 
        path: normalizedPath, 
        content, 
        size: contentBytes.length 
      });
    }

    // Step 1: Create upload session
    const sessionResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/assets-upload-session`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ manifest }),
      }
    );

    if (!sessionResponse.ok) {
      const errorData = await sessionResponse.json() as any;
      return json({ 
        error: `Failed to create upload session: ${errorData.errors?.[0]?.message || sessionResponse.statusText}` 
      }, { status: sessionResponse.status });
    }

    const session = await sessionResponse.json() as { result: CloudflareUploadSession };
    const { jwt, buckets } = session.result;

    // Step 2: Check which files need uploading
    const allHashes = buckets.flat();
    const checkResponse = await fetch(
      'https://api.cloudflare.com/client/v4/pages/assets/check-missing',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hashes: allHashes }),
      }
    );

    let missingHashes: string[] = allHashes;
    if (checkResponse.ok) {
      const checkData = await checkResponse.json() as { result: { missing: string[] } };
      missingHashes = checkData.result.missing || allHashes;
    }

    // Step 3: Upload missing files in batches
    const missingFiles = missingHashes
      .map(hash => fileContents.get(hash))
      .filter(Boolean) as Array<{ path: string; content: string; size: number }>;

    // Group files into batches by size
    const batches: Array<typeof missingFiles> = [];
    let currentBatch: typeof missingFiles = [];
    let currentBatchSize = 0;

    for (const file of missingFiles) {
      if (
        currentBatch.length >= MAX_FILES_PER_BATCH ||
        currentBatchSize + file.size > MAX_BATCH_SIZE
      ) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentBatchSize = 0;
      }
      currentBatch.push(file);
      currentBatchSize += file.size;
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Upload each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const formData = new FormData();

      for (const file of batch) {
        const blob = new Blob([file.content], { type: 'application/octet-stream' });
        formData.append(file.path, blob);
      }

      let uploadSuccess = false;
      let retries = 0;
      const maxRetries = 3;

      while (!uploadSuccess && retries < maxRetries) {
        try {
          const uploadResponse = await fetch(
            'https://api.cloudflare.com/client/v4/pages/assets/upload',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
              body: formData,
            }
          );

          if (uploadResponse.ok) {
            uploadSuccess = true;
          } else if (uploadResponse.status === 429) {
            // Rate limited - wait and retry
            const retryAfter = parseInt(uploadResponse.headers.get('Retry-After') || '5');
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            retries++;
          } else {
            throw new Error(`Upload failed: ${uploadResponse.status}`);
          }
        } catch (error) {
          retries++;
          if (retries >= maxRetries) {
            return json({ 
              error: `Failed to upload batch ${i + 1}/${batches.length}` 
            }, { status: 500 });
          }
          await new Promise(resolve => setTimeout(resolve, 2000 * retries));
        }
      }
    }

    // Step 4: Generate deployment ID and URL
    const deploymentId = `cf-${chatId}-${Date.now()}`;
    const deploymentUrl = authMode === 'platform-managed'
      ? `https://${chatId}.huskit-sites.workers.dev`
      : `https://${workerName}.workers.dev`;

    // TODO: Store deployment record in database

    return json({
      success: true,
      deploymentId,
      status: 'ready',
      url: deploymentUrl,
    } as DeployResponse);

  } catch (error) {
    console.error('Cloudflare deploy error:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Deployment failed' 
    }, { status: 500 });
  }
}
```

### Step 2.3: Create Cloudflare Deploy Client Hook

Create `app/components/deploy/CloudflareDeploy.client.tsx`:

```typescript
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { cloudflareConnection } from '~/lib/stores/cloudflare';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';

export function useCloudflareDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const cloudflareConn = useStore(cloudflareConnection);
  const currentChatId = useStore(chatId);

  const handleCloudflareDeploy = async () => {
    // Platform-managed mode doesn't require user connection
    const isPlatformManaged = !cloudflareConn.user;

    if (!currentChatId) {
      toast.error('No active chat found');
      return false;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Create a deployment artifact for visual feedback
      const deploymentId = `deploy-cloudflare-project`;
      workbenchStore.addArtifact({
        id: deploymentId,
        messageId: deploymentId,
        title: 'Cloudflare Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentId];

      // Notify that build is starting
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'cloudflare' });

      // Set up build action
      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'cloudflare build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'cloudflare',
        });
        throw new Error('Build failed');
      }

      // Notify that build succeeded and deployment is starting
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'cloudflare' });

      // Get the build files
      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      // Find build directory
      let finalBuildPath = buildPath;
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];
      let buildPathExists = false;

      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          buildPathExists = true;
          break;
        } catch {
          continue;
        }
      }

      if (!buildPathExists) {
        throw new Error('Could not find build output directory');
      }

      // Get all files recursively
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, 'utf-8');
            const deployPath = fullPath.replace(finalBuildPath, '');
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);

      // Deploy
      const response = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          chatId: currentChatId,
          authMode: isPlatformManaged ? 'platform-managed' : 'user-token',
          token: cloudflareConn.token,
          accountId: cloudflareConn.accountId,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || !data.success) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Deployment failed',
          source: 'cloudflare',
        });
        throw new Error(data.error || 'Deployment failed');
      }

      // Store deployment info
      localStorage.setItem(`cloudflare-deployment-${currentChatId}`, JSON.stringify({
        deploymentId: data.deploymentId,
        url: data.url,
      }));

      // Notify success
      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.url,
        source: 'cloudflare',
      });

      toast.success('🚀 Cloudflare deployment completed successfully!');
      return true;

    } catch (error) {
      console.error('Cloudflare deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleCloudflareDeploy,
    isConnected: !!cloudflareConn.user,
    isPlatformManagedAvailable: true, // Always available for platform-managed mode
  };
}
```

---

## Phase 3: AWS Amplify Integration

**Estimated Time:** 1-2 days

### Step 3.1: Create Amplify Store

Create `app/lib/stores/amplify.ts`:

```typescript
import { atom } from 'nanostores';
import type { AmplifyConnection } from '~/types/deployment';
import { logStore } from './logs';
import { toast } from 'react-toastify';

const storedConnection = typeof window !== 'undefined' 
  ? localStorage.getItem('amplify_connection') 
  : null;

const initialConnection: AmplifyConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: null,
      token: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
    };

export const amplifyConnection = atom<AmplifyConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

export const updateAmplifyConnection = (updates: Partial<AmplifyConnection>) => {
  const currentState = amplifyConnection.get();
  const newState = { ...currentState, ...updates };
  amplifyConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('amplify_connection', JSON.stringify(newState));
  }
};

export async function validateAmplifyCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // We'll validate by making a test API call
    // This will be done server-side to keep credentials secure
    const response = await fetch('/api/amplify-validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
    });

    const data = await response.json() as any;
    return { valid: data.valid, error: data.error };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

export async function fetchAmplifyStats(
  accessKeyId: string,
  secretAccessKey: string,
  region: string
) {
  try {
    isFetchingStats.set(true);

    // Fetch apps list via server-side API
    const response = await fetch('/api/amplify-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status}`);
    }

    const data = await response.json() as any;

    const currentState = amplifyConnection.get();
    updateAmplifyConnection({
      ...currentState,
      stats: {
        apps: data.apps || [],
        totalApps: data.apps?.length || 0,
      },
    });
  } catch (error) {
    console.error('Amplify API Error:', error);
    logStore.logError('Failed to fetch Amplify stats', { error });
    toast.error('Failed to fetch Amplify statistics');
  } finally {
    isFetchingStats.set(false);
  }
}
```

### Step 3.2: Create Amplify Deploy API Route

Create `app/routes/api.amplify-deploy.ts`:

```typescript
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
    const body = await request.json() as DeployRequestBody;
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
      const getBranchResponse = await aws.fetch(
        `${amplifyBaseUrl}/apps/${appId}/branches/${branchName}`,
        { method: 'GET' }
      );

      if (!getBranchResponse.ok && getBranchResponse.status !== 404) {
        throw new Error(`Failed to check branch: ${getBranchResponse.status}`);
      }

      if (getBranchResponse.status === 404) {
        // Create branch
        const createBranchResponse = await aws.fetch(
          `${amplifyBaseUrl}/apps/${appId}/branches`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              branchName,
              stage: 'PRODUCTION',
              enableAutoBuild: false,
            }),
          }
        );

        if (!createBranchResponse.ok && createBranchResponse.status !== 409) {
          const errorData = await createBranchResponse.json() as any;
          throw new Error(`Failed to create branch: ${errorData.message || createBranchResponse.status}`);
        }
      }
    } catch (error) {
      console.error('Branch setup error:', error);
      return json({ 
        error: `Failed to setup branch: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, { status: 500 });
    }

    // Step 2: Create deployment
    const createDeployResponse = await aws.fetch(
      `${amplifyBaseUrl}/apps/${appId}/branches/${branchName}/deployments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );

    if (!createDeployResponse.ok) {
      const errorData = await createDeployResponse.json() as any;
      return json({ 
        error: `Failed to create deployment: ${errorData.message || createDeployResponse.status}` 
      }, { status: 500 });
    }

    const deploymentData = await createDeployResponse.json() as {
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
      return json({ 
        error: `Deployment package too large. Maximum is 50MB, got ${Math.round(zipBlob.size / 1024 / 1024)}MB` 
      }, { status: 400 });
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
      return json({ 
        error: `Failed to upload deployment package: ${uploadResponse.status}` 
      }, { status: 500 });
    }

    // Step 5: Start deployment
    const startDeployResponse = await aws.fetch(
      `${amplifyBaseUrl}/apps/${appId}/branches/${branchName}/deployments/start`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: deploymentData.jobId }),
      }
    );

    if (!startDeployResponse.ok) {
      const errorData = await startDeployResponse.json() as any;
      return json({ 
        error: `Failed to start deployment: ${errorData.message || startDeployResponse.status}` 
      }, { status: 500 });
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
    return json({ 
      error: error instanceof Error ? error.message : 'Deployment failed' 
    }, { status: 500 });
  }
}
```

### Step 3.3: Create Amplify Deploy Client Hook

Create `app/components/deploy/AmplifyDeploy.client.tsx`:

```typescript
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { amplifyConnection } from '~/lib/stores/amplify';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState, useEffect, useRef } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';

const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_ATTEMPTS = 120; // 6 minutes max

export function useAmplifyDeploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const amplifyConn = useStore(amplifyConnection);
  const currentChatId = useStore(chatId);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const pollDeploymentStatus = async (
    deploymentId: string,
    externalId: string,
    deployArtifact: any
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      pollIntervalRef.current = setInterval(async () => {
        attempts++;

        if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(pollIntervalRef.current!);
          reject(new Error('Deployment timed out'));
          return;
        }

        try {
          const response = await fetch(
            `/api/deploy-status?platform=amplify&deploymentId=${deploymentId}&externalId=${externalId}`
          );
          const status = await response.json() as any;

          if (status.status === 'ready') {
            clearInterval(pollIntervalRef.current!);
            deployArtifact.runner.handleDeployAction('complete', 'complete', {
              url: status.url,
              source: 'amplify',
            });
            resolve();
          } else if (status.status === 'error') {
            clearInterval(pollIntervalRef.current!);
            reject(new Error(status.error || 'Deployment failed'));
          } else {
            // Still building/deploying
            deployArtifact.runner.handleDeployAction('deploying', 'running', {
              source: 'amplify',
              progress: status.progress,
            });
          }
        } catch (error) {
          // Continue polling on network errors
          console.error('Status poll error:', error);
        }
      }, POLL_INTERVAL);
    });
  };

  const handleAmplifyDeploy = async () => {
    const isPlatformManaged = !amplifyConn.user;

    if (!currentChatId) {
      toast.error('No active chat found');
      return false;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error('No active project found');
      }

      // Create deployment artifact
      const deploymentArtifactId = `deploy-amplify-project`;
      workbenchStore.addArtifact({
        id: deploymentArtifactId,
        messageId: deploymentArtifactId,
        title: 'AWS Amplify Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentArtifactId];

      // Build phase
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'amplify' });

      const actionId = 'build-' + Date.now();
      const actionData: ActionCallbackData = {
        messageId: 'amplify build',
        artifactId: artifact.id,
        actionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      artifact.runner.addAction(actionData);
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'amplify',
        });
        throw new Error('Build failed');
      }

      // Upload phase
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'amplify' });

      const container = await webcontainer;
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      // Find build directory
      let finalBuildPath = buildPath;
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];
      
      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          break;
        } catch {
          continue;
        }
      }

      // Get all files
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, 'utf-8');
            const deployPath = fullPath.replace(finalBuildPath, '');
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);

      // Deploy
      const response = await fetch('/api/amplify-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          chatId: currentChatId,
          authMode: isPlatformManaged ? 'platform-managed' : 'user-token',
          accessKeyId: amplifyConn.accessKeyId,
          secretAccessKey: amplifyConn.secretAccessKey,
          region: amplifyConn.region,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || !data.success) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Deployment failed',
          source: 'amplify',
        });
        throw new Error(data.error || 'Deployment failed');
      }

      // Store deployment info
      localStorage.setItem(`amplify-deployment-${currentChatId}`, JSON.stringify({
        deploymentId: data.deploymentId,
        externalId: data.externalId,
        url: data.url,
      }));

      // Poll for completion (Amplify builds take time)
      toast.info('Amplify deployment started. Building...');
      await pollDeploymentStatus(data.deploymentId, data.externalId, deployArtifact);

      toast.success('🚀 AWS Amplify deployment completed successfully!');
      return true;

    } catch (error) {
      console.error('Amplify deploy error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleAmplifyDeploy,
    isConnected: !!amplifyConn.user,
    isPlatformManagedAvailable: true,
  };
}
```

---

## Phase 4: UI Integration

**Estimated Time:** 4-6 hours

### Step 4.1: Update DeployButton

Modify `app/components/deploy/DeployButton.tsx` to add Amplify and Cloudflare options:

```typescript
// Add imports
import { useAmplifyDeploy } from '~/components/deploy/AmplifyDeploy.client';
import { useCloudflareDeploy } from '~/components/deploy/CloudflareDeploy.client';
import { amplifyConnection } from '~/lib/stores/amplify';
import { cloudflareConnection } from '~/lib/stores/cloudflare';

// Inside component, add:
const amplifyConn = useStore(amplifyConnection);
const cloudflareConn = useStore(cloudflareConnection);
const { handleAmplifyDeploy } = useAmplifyDeploy();
const { handleCloudflareDeploy } = useCloudflareDeploy();

// Add click handlers
const handleAmplifyDeployClick = async () => {
  setIsDeploying(true);
  setDeployingTo('amplify');
  try {
    await handleAmplifyDeploy();
  } finally {
    setIsDeploying(false);
    setDeployingTo(null);
  }
};

const handleCloudflareDeployClick = async () => {
  setIsDeploying(true);
  setDeployingTo('cloudflare');
  try {
    await handleCloudflareDeploy();
  } finally {
    setIsDeploying(false);
    setDeployingTo(null);
  }
};

// Replace the disabled Cloudflare menu item with:
<DropdownMenu.Item
  className={classNames(
    'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
    {
      'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
    },
  )}
  disabled={isDeploying || !activePreview}
  onClick={handleCloudflareDeployClick}
>
  <img
    className="w-5 h-5"
    height="24"
    width="24"
    crossOrigin="anonymous"
    src="https://cdn.simpleicons.org/cloudflare"
    alt="cloudflare"
  />
  <span className="mx-auto">
    {!cloudflareConn.user ? 'Deploy to Cloudflare (Quick Deploy)' : 'Deploy to Cloudflare'}
  </span>
</DropdownMenu.Item>

// Add new Amplify menu item:
<DropdownMenu.Item
  className={classNames(
    'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
    {
      'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
    },
  )}
  disabled={isDeploying || !activePreview}
  onClick={handleAmplifyDeployClick}
>
  <img
    className="w-5 h-5"
    height="24"
    width="24"
    crossOrigin="anonymous"
    src="https://cdn.simpleicons.org/awsamplify"
    alt="aws amplify"
  />
  <span className="mx-auto">
    {!amplifyConn.user ? 'Deploy to Amplify (Quick Deploy)' : 'Deploy to AWS Amplify'}
  </span>
</DropdownMenu.Item>
```

### Step 4.2: Create Settings Tabs

Create `app/components/@settings/tabs/cloudflare/CloudflareTab.tsx` following the pattern of `NetlifyTab.tsx`.

Create `app/components/@settings/tabs/amplify/AmplifyTab.tsx` following the pattern of `VercelTab.tsx` but with:
- Access Key ID input
- Secret Access Key input (password field)
- Region selector dropdown
- App ID input (optional, for existing apps)

### Step 4.3: Update Settings Window

Add the new tabs to `app/components/@settings/SettingsWindow.tsx`:

```typescript
// Add imports
import CloudflareTab from './tabs/cloudflare/CloudflareTab';
import AmplifyTab from './tabs/amplify/AmplifyTab';

// Add to tabs array
{ id: 'cloudflare', label: 'Cloudflare', icon: 'i-ph:cloud' },
{ id: 'amplify', label: 'AWS Amplify', icon: 'i-ph:cloud-arrow-up' },

// Add tab content rendering
{activeTab === 'cloudflare' && <CloudflareTab />}
{activeTab === 'amplify' && <AmplifyTab />}
```

---

## Phase 5: User Token Mode

**Estimated Time:** 1 day

### Step 5.1: Server-Side Token Storage

Create database table for encrypted token storage:

```sql
CREATE TABLE user_platform_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  encrypted_token TEXT NOT NULL,
  token_metadata JSONB, -- For non-sensitive data like account ID, region
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE user_platform_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens"
  ON user_platform_tokens FOR ALL
  USING (auth.uid() = user_id);
```

### Step 5.2: Token Encryption API

Create `app/routes/api.platform-tokens.ts` for secure token storage and retrieval.

### Step 5.3: Update Settings Tabs

Modify the settings tabs to:
1. Send tokens to server for encrypted storage
2. Store only session reference in localStorage
3. Retrieve tokens from server when needed for deployment

---

## Testing Strategy

### Unit Tests

- [ ] Test deployment type validation
- [ ] Test file hash calculation
- [ ] Test ZIP creation with jszip
- [ ] Test SigV4 signing with aws4fetch

### Integration Tests

- [ ] Test Cloudflare upload session flow (mock API)
- [ ] Test Amplify deployment flow (mock API)
- [ ] Test status polling endpoint
- [ ] Test error handling and retries

### E2E Tests

- [ ] Deploy a simple static site to Cloudflare
- [ ] Deploy a simple static site to Amplify
- [ ] Verify deployment URLs are accessible
- [ ] Test platform-managed mode
- [ ] Test user-token mode

---

## Rollout Plan

### Week 1: Core Infrastructure
- [ ] Merge Phase 1 (types, status endpoint, DB schema)
- [ ] Deploy to staging environment
- [ ] Validate database migrations

### Week 2: Cloudflare Integration
- [ ] Merge Phase 2 (Cloudflare Workers Assets)
- [ ] Test with internal team
- [ ] Enable for beta users (platform-managed only)

### Week 3: AWS Amplify Integration
- [ ] Merge Phase 3 (AWS Amplify)
- [ ] Test with internal team
- [ ] Enable for beta users (platform-managed only)

### Week 4: UI & User Token Mode
- [ ] Merge Phase 4 (UI integration)
- [ ] Merge Phase 5 (user token mode)
- [ ] General availability

---

## Appendix: File Changes Summary

| Action | File | Phase |
|--------|------|-------|
| Create | `app/types/deployment.ts` | 1 |
| Create | `app/routes/api.deploy-status.ts` | 1 |
| Create | `supabase/migrations/xxx_deployments.sql` | 1 |
| Modify | `worker-configuration.d.ts` | 1 |
| Create | `app/lib/stores/cloudflare.ts` | 2 |
| Create | `app/routes/api.cloudflare-deploy.ts` | 2 |
| Create | `app/components/deploy/CloudflareDeploy.client.tsx` | 2 |
| Create | `app/lib/stores/amplify.ts` | 3 |
| Create | `app/routes/api.amplify-deploy.ts` | 3 |
| Create | `app/components/deploy/AmplifyDeploy.client.tsx` | 3 |
| Modify | `app/components/deploy/DeployButton.tsx` | 4 |
| Create | `app/components/@settings/tabs/cloudflare/CloudflareTab.tsx` | 4 |
| Create | `app/components/@settings/tabs/amplify/AmplifyTab.tsx` | 4 |
| Modify | `app/components/@settings/SettingsWindow.tsx` | 4 |
| Modify | `package.json` | 1 |
| Modify | `.env.example` | 1 |
| Create | `app/routes/api.platform-tokens.ts` | 5 |
| Create | `supabase/migrations/xxx_user_tokens.sql` | 5 |
