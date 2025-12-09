# User-Generated Website Deployment Feature

## Executive Summary

Implement deployment of user-generated websites to AWS Amplify and Cloudflare Workers Static Assets, supporting two authentication modes:

1. **User Token Flow** - Users paste their own AWS/Cloudflare API tokens
2. **Platform-Managed** - Instant deployment to your infrastructure with auto-generated subdomains

> **Note:** True OAuth for AWS requires OIDC + IAM role assumption (complex). For v1, we support manual token input for user-owned deployments.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Deploy Button UI                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Netlify  │ │  Vercel  │ │ Amplify  │ │    Cloudflare    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
└───────┼────────────┼────────────┼────────────────┼─────────────┘
        │            │            │                │
        ▼            ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Deployment Service Layer                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Auth Mode Router                                            ││
│  │  ├─ User Token: Use user's API token → Deploy to their acct ││
│  │  └─ Platform: Use system creds → Deploy to shared infra     ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Async Deployment Pattern                                    ││
│  │  ├─ POST /api.*-deploy → Returns deploymentId immediately   ││
│  │  └─ GET /api.deploy-status → Client polls for completion    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Platform APIs                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐│
│  │ AWS Amplify REST API │  │ Cloudflare Workers Assets API    ││
│  │ - CreateDeployment   │  │ - assets-upload-session          ││
│  │ - Upload ZIP (S3)    │  │ - assets/upload (batched)        ││
│  │ - StartDeployment    │  │ - Create Worker version          ││
│  │ - GetJob (poll)      │  │ - Poll deployment status         ││
│  └──────────────────────┘  └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Critical Design Decisions

### Why Workers Static Assets Instead of Cloudflare Pages?

| Aspect | Cloudflare Pages | Workers Static Assets |
|--------|------------------|----------------------|
| **API Support** | ❌ No direct file upload API documented | ✅ Full API: JWT + batch upload |
| **Programmatic Deploy** | Requires Wrangler CLI | Works via REST API |
| **Quota Limits** | 100 projects/account | Per-Worker limits (higher) |
| **From Workers Runtime** | Not supported | ✅ Native support |

**Decision:** Use Workers Static Assets API for v1. Users get URLs like `{id}.your-domain.com` instead of `*.pages.dev`.

### Why Not Full AWS SDK?

| Aspect | @aws-sdk/client-amplify | aws4fetch + fetch |
|--------|------------------------|-------------------|
| **Bundle Size** | ~500KB+ with deps | ~3KB |
| **Workers Compatible** | ⚠️ Requires polyfills | ✅ Native |
| **Complexity** | Higher | Lower |

**Decision:** Use `jszip` (already in deps) + `aws4fetch` for minimal SigV4 signing.

---

## Platform Comparison & Implementation Strategy

| Feature | AWS Amplify | Cloudflare Workers Assets |
|---------|-------------|---------------------------|
| **API Style** | REST + SigV4 signing | REST + JWT tokens |
| **Auth Method** | IAM credentials or access keys | API Tokens (scoped) |
| **Auto URL** | `*.amplifyapp.com` | Custom domain required |
| **Build Support** | Server-side builds | Pre-built only |
| **Static Deploy** | ZIP upload to S3 presigned URL | Batch file upload |
| **Best For** | AWS ecosystem users | Global edge performance |
| **Quota Limits** | 50 branches/app, 25 apps/region | 20k files, 25MB/file |

---

## Implementation Plan

### Phase 1: Core Infrastructure

**1.1 Create Shared Deployment Types**

New file: `app/types/deployment.ts`

```typescript
export type DeploymentPlatform = 'amplify' | 'cloudflare' | 'netlify' | 'vercel';
export type AuthMode = 'user-token' | 'platform-managed';

export interface DeploymentConfig {
  platform: DeploymentPlatform;
  authMode: AuthMode;
  files: Record<string, string>;
  projectName: string;
  chatId: string;
  framework?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url: string;
  platform: DeploymentPlatform;
  status: 'pending' | 'building' | 'ready' | 'error';
  error?: string;
}

export interface DeploymentStatus {
  deploymentId: string;
  platform: DeploymentPlatform;
  status: 'pending' | 'building' | 'ready' | 'error';
  url?: string;
  error?: string;
  progress?: number;
}

export interface PlatformConnection {
  token: string;
  user?: { id: string; name: string; email?: string };
  accountId?: string;
}

export interface AmplifyConnection extends PlatformConnection {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  appId?: string;
}

export interface CloudflareConnection extends PlatformConnection {
  accountId: string;
}
```

**1.2 Create Deploy Status Endpoint**

New file: `app/routes/api.deploy-status.ts`

```typescript
// Unified status polling endpoint
// GET /api/deploy-status?platform=amplify&deploymentId=xxx&token=xxx
// Returns: DeploymentStatus

// This avoids long-polling in Workers (30s limit)
// Client polls every 2-3 seconds
```

**1.3 Environment Variables Required**

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

**1.4 Database Schema for Deployment Tracking**

```sql
-- Track deployments for cleanup and status
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  external_id TEXT,           -- Platform's deployment/job ID
  external_project_id TEXT,   -- Platform's project/app/branch ID
  status TEXT DEFAULT 'pending',
  url TEXT,
  error TEXT,
  file_count INTEGER,
  total_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ      -- For TTL cleanup
);

CREATE INDEX idx_deployments_user ON deployments(user_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_expires ON deployments(expires_at) WHERE expires_at IS NOT NULL;
```

---

### Phase 2: Cloudflare Workers Static Assets Integration

**2.1 Cloudflare Store** - `app/lib/stores/cloudflare.ts`

Follow the pattern from `app/lib/stores/netlify.ts`.

**2.2 Cloudflare API Route** - `app/routes/api.cloudflare-deploy.ts`

```typescript
// Key implementation points:
// 1. Get upload session JWT: POST /accounts/{id}/workers/scripts/{name}/assets-upload-session
// 2. Check missing hashes: POST /pages/assets/check-missing (with JWT)
// 3. Batch upload files: POST /pages/assets/upload (with JWT, max 40MB/batch)
// 4. Complete upload session with manifest
// 5. Return immediately with deploymentId, client polls status

// File hashing: Use SHA-256 for content hashes
// Batching: Group files into 40MB buckets, max 2000 files per batch
// Retry: Exponential backoff on 429/5xx errors
```

**2.3 Cloudflare Deploy Client** - `app/components/deploy/CloudflareDeploy.client.tsx`

```typescript
// Key implementation points:
// 1. Build project locally (npm run build)
// 2. Collect build output files
// 3. POST to /api/cloudflare-deploy
// 4. Poll /api/deploy-status until ready or error
// 5. Update artifact runner with status
```

**2.4 Cloudflare Workers Assets API Flow**

```
1. Create upload session
   POST /accounts/{accountId}/workers/scripts/{scriptName}/assets-upload-session
   Body: { manifest: { "/path": "sha256hash", ... } }
   Response: { jwt, buckets: [["hash1", "hash2"], ...] }

2. Check which files need upload (optimization)
   POST /pages/assets/check-missing
   Headers: Authorization: Bearer {jwt}
   Body: { hashes: ["hash1", "hash2", ...] }
   Response: ["hash3", "hash5"]  // Only missing ones

3. Upload files in batches (max 40MB per batch, 3 concurrent)
   POST /pages/assets/upload
   Headers: Authorization: Bearer {jwt}
   Body: [
     { key: "hash1", value: "base64content", metadata: { contentType: "text/html" }, base64: true },
     ...
   ]

4. Complete session (implicit when all buckets uploaded)
   The Worker version is now ready

5. Poll deployment status
   GET /accounts/{accountId}/workers/scripts/{scriptName}
   Check: latest deployment status

6. Return URL: https://{scriptName}.{accountId}.workers.dev
   Or custom domain if configured
```

---

### Phase 3: AWS Amplify Integration

**3.1 Amplify Store** - `app/lib/stores/amplify.ts`

Follow the pattern from `app/lib/stores/netlify.ts`.

**3.2 Amplify API Route** - `app/routes/api.amplify-deploy.ts`

```typescript
// Key implementation points:
// 1. Use jszip for ZIP creation (already in deps, Workers-compatible)
// 2. Use aws4fetch for SigV4 signing (add to deps, ~3KB)
// 3. CreateDeployment → get presigned URL → upload ZIP → StartDeployment
// 4. Return immediately with jobId, client polls status
// 5. Support platform-managed (shared app) and user-token modes

import JSZip from 'jszip';
import { AwsClient } from 'aws4fetch';

async function createZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    const normalized = path.startsWith('/') ? path.slice(1) : path;
    zip.file(normalized, content);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
```

**3.3 Amplify Deploy Client** - `app/components/deploy/AmplifyDeploy.client.tsx`

Follow the pattern from `app/components/deploy/VercelDeploy.client.tsx`.

**3.4 AWS Amplify API Flow**

```
1. Get or create branch (for platform-managed: branch = chatId)
   POST https://amplify.{region}.amazonaws.com/apps/{appId}/branches
   Body: { branchName: "{chatId}", stage: "PRODUCTION" }
   (Skip if branch exists, handle 409 Conflict)

2. Create deployment
   POST https://amplify.{region}.amazonaws.com/apps/{appId}/branches/{branchName}/deployments
   Response: { jobId, zipUploadUrl }
   ⚠️ 8-hour window to complete upload

3. Create ZIP and upload to presigned S3 URL
   PUT {zipUploadUrl}
   Headers: Content-Type: application/zip
   Body: <zip bytes>

4. Start deployment
   POST https://amplify.{region}.amazonaws.com/apps/{appId}/branches/{branchName}/deployments/start
   Body: { jobId }
   Response: { jobSummary: { status: "PENDING" } }

5. Poll job status (via /api/deploy-status)
   GET https://amplify.{region}.amazonaws.com/apps/{appId}/branches/{branchName}/jobs/{jobId}
   Until: status = "SUCCEED" or "FAILED"

6. Return URL: https://{branchName}.{appId}.amplifyapp.com
```

---

### Phase 4: Platform-Managed Deployment Mode

**4.1 Shared Infrastructure Setup**

| Platform | Strategy | Limits | Cleanup |
|----------|----------|--------|---------|
| **Amplify** | Single app, branch per chatId | 50 branches/app | Delete branches after 30 days |
| **Cloudflare** | Single Worker, route per chatId | 20k files total | Prune old routes after 30 days |

**4.2 URL Generation Strategy**

| Platform | User-Token Mode URL | Platform-Managed URL |
|----------|---------------------|---------------------|
| Amplify | `{branch}.{userAppId}.amplifyapp.com` | `{chatId}.{platformAppId}.amplifyapp.com` |
| Cloudflare | `{user-worker}.workers.dev` | `{chatId}.huskit-sites.workers.dev` |

**4.3 Quota Management**

```typescript
// Before creating platform-managed deployment:
const AMPLIFY_MAX_BRANCHES = 40;  // Leave buffer under 50 limit
const CLOUDFLARE_MAX_SITES = 80;  // Leave buffer under soft limits

async function checkQuota(platform: string): Promise<boolean> {
  const activeCount = await db.deployments.count({
    platform,
    authMode: 'platform-managed',
    status: 'ready',
    expiresAt: { gt: new Date() }
  });
  
  const limit = platform === 'amplify' ? AMPLIFY_MAX_BRANCHES : CLOUDFLARE_MAX_SITES;
  return activeCount < limit;
}
```

**4.4 Cleanup Job**

```typescript
// Run daily via cron or Cloudflare Scheduled Worker
async function cleanupExpiredDeployments() {
  const expired = await db.deployments.findMany({
    where: {
      authMode: 'platform-managed',
      expiresAt: { lt: new Date() }
    }
  });

  for (const deployment of expired) {
    if (deployment.platform === 'amplify') {
      await deleteAmplifyBranch(deployment.externalProjectId);
    } else if (deployment.platform === 'cloudflare') {
      await deleteWorkerRoute(deployment.externalId);
    }
    await db.deployments.delete({ id: deployment.id });
  }
}
```

**4.5 Security Considerations**

- Rate limit platform-managed deployments: **5 per hour per user, 20 per day**
- Implement content scanning for malicious code patterns
- Set resource limits: **50MB per deployment, 5,000 files**
- Auto-cleanup for inactive deployments: **30-day TTL**
- Store user tokens **server-side in DB with encryption**, not localStorage

---

### Phase 5: UI Integration

**5.1 Update DeployButton** - `app/components/deploy/DeployButton.tsx`

Add Amplify and Cloudflare options to the dropdown.

**5.2 Settings Tabs**

New files in `app/components/@settings/tabs/`:
- `amplify/AmplifyTab.tsx` - Access key input, region selector
- `cloudflare/CloudflareTab.tsx` - API token input, account ID

**5.3 Deployment Mode Selector**

When user has no connection configured, show option:
- "Connect your AWS/Cloudflare account" → Settings tab
- "Quick deploy (instant URL, 30-day limit)" → Platform-managed

---

## File Changes Summary

| Action | File | Notes |
|--------|------|-------|
| Create | `app/types/deployment.ts` | Shared types |
| Create | `app/lib/stores/amplify.ts` | Connection state |
| Create | `app/lib/stores/cloudflare.ts` | Connection state |
| Create | `app/routes/api.amplify-deploy.ts` | Deploy endpoint |
| Create | `app/routes/api.cloudflare-deploy.ts` | Deploy endpoint |
| Create | `app/routes/api.deploy-status.ts` | **Unified status polling** |
| Create | `app/components/deploy/AmplifyDeploy.client.tsx` | Deploy hook |
| Create | `app/components/deploy/CloudflareDeploy.client.tsx` | Deploy hook |
| Create | `app/components/@settings/tabs/amplify/` | Settings UI |
| Create | `app/components/@settings/tabs/cloudflare/` | Settings UI |
| Modify | `app/components/deploy/DeployButton.tsx` | Add platforms |
| Modify | `app/components/@settings/SettingsWindow.tsx` | Add tabs |
| Modify | `package.json` | Add aws4fetch |
| Create | `supabase/migrations/xxx_deployments.sql` | DB schema |

---

## Dependencies to Add

```json
{
  "aws4fetch": "^1.0.20"
}
```

> **Note:** `jszip` is already in dependencies. Do NOT add `archiver` (Node-only, not Workers-compatible).

---

## Security Best Practices

1. **Token Storage**: Store user tokens **server-side in encrypted DB**, not localStorage. Browser gets session reference only.
2. **Rate Limiting**: 
   - Platform-managed: 5/hour, 20/day per user
   - User-token: 20/hour per user
3. **Content Validation**: Scan for `<script src="malicious">`, known phishing patterns
4. **Size Limits**: Max 50MB per deployment, 5,000 files
5. **Audit Logging**: Log all deployments with user ID, chatId, timestamp, platform, file count
6. **Credential Scope**:
   - Cloudflare: `Workers Scripts:Edit`, `Account:Read` only
   - AWS: Custom IAM policy for Amplify + S3 presigned uploads only

**IAM Policy for Platform-Managed Amplify:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:CreateBranch",
        "amplify:DeleteBranch",
        "amplify:CreateDeployment",
        "amplify:StartDeployment",
        "amplify:GetJob",
        "amplify:ListBranches"
      ],
      "Resource": "arn:aws:amplify:*:*:apps/{AMPLIFY_APP_ID}/*"
    }
  ]
}
```

---

## Recommended Implementation Order

1. **Phase 1: Infrastructure** (S - 2-4 hours)
   - Create types, deploy-status endpoint, DB schema

2. **Phase 2: Cloudflare Workers Assets** (M - 1-2 days)
   - Implement upload flow, store, client hook
   - Platform-managed only for v1

3. **Phase 3: AWS Amplify** (M-L - 1-2 days)
   - Implement with jszip + aws4fetch
   - Platform-managed only for v1

4. **Phase 4: UI Integration** (S - 4-6 hours)
   - Update DeployButton, add settings tabs

5. **Phase 5: User Token Mode** (M - 1 day)
   - Add token input UI
   - Server-side token storage

6. **Future: Full AWS OAuth** (XL - out of scope for v1)
   - OIDC + IAM role assumption flow

---

## Error Handling Strategy

| Error Type | HTTP Code | User Message | Recovery |
|------------|-----------|--------------|----------|
| Missing token | 401 | "Please connect your account first" | Redirect to settings |
| Rate limited | 429 | "Too many deployments. Try again in X minutes" | Show countdown |
| Quota exceeded | 429 | "Platform deployment limit reached" | Suggest user-token mode |
| Platform error | 502 | "Deployment service unavailable" | Retry button |
| Timeout | 504 | "Deployment timed out" | Link to status page |
| Invalid files | 400 | "Files exceed size limit" | Show limits |

---

## Implementation Status

| Task | Status | Priority |
|------|--------|----------|
| Create deployment types | Pending | P0 |
| Create deploy-status endpoint | Pending | P0 |
| Create DB schema for deployments | Pending | P0 |
| Implement Cloudflare Workers Assets deploy | Pending | P1 |
| Create CloudflareDeploy.client.tsx hook | Pending | P1 |
| Create Cloudflare settings tab | Pending | P1 |
| Implement AWS Amplify deploy with jszip | Pending | P1 |
| Create AmplifyDeploy.client.tsx hook | Pending | P1 |
| Create Amplify settings tab | Pending | P1 |
| Update DeployButton.tsx | Pending | P2 |
| Implement cleanup job | Pending | P2 |
| Add user-token mode | Pending | P3 |
