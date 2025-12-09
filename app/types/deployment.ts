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
  stats?: {
    apps: Array<{ id: string; name: string }>;
    totalApps: number;
  };
}

/**
 * Cloudflare Workers connection
 */
export interface CloudflareConnection extends PlatformConnection {
  accountId: string;
  workerName?: string; // Existing worker to update
  stats?: {
    workers: Array<{ id: string; name: string }>;
    totalWorkers: number;
  };
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
  [path: string]: { hash: string; size: number };
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
  sourceFiles?: Record<string, string>; // Full source code for framework detection
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
