/**
 * Server-side environment configuration with validation
 *
 * This module provides typed access to server-side environment variables
 * with runtime validation. Used by server-only code (Remix .server pattern).
 *
 * Based on specs/001-places-crawler/plan.md
 */

import { z } from 'zod';

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  /*
   * ============================================================================
   * Database Configuration
   * ============================================================================
   */
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),

  /*
   * ============================================================================
   * Supabase Configuration
   * ============================================================================
   */
  SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'SUPABASE_ANON_KEY is required')
    .describe('Supabase anonymous/public key for client-side access'),

  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required')
    .describe('Supabase service role key for server-side admin access (bypasses RLS)'),

  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a valid URL')
    .describe('Supabase project URL (e.g., https://xxxxx.supabase.co)'),

  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'VITE_SUPABASE_ANON_KEY is required')
    .describe('Supabase anonymous/public key for client-side access'),

  /*
   * ============================================================================
   * Cloudflare R2 Configuration
   * ============================================================================
   */
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid HTTPS URL').optional(),
  R2_ACCESS_KEY: z.string().min(1, 'R2_ACCESS_KEY is required').optional(),
  R2_SECRET_KEY: z.string().min(1, 'R2_SECRET_KEY is required').optional(),
  R2_BUCKET: z.string().min(1, 'R2_BUCKET name is required').optional(),

  /*
   * ============================================================================
   * Internal Places Data Service Configuration
   * ============================================================================
   */
  INTERNAL_PLACES_SERVICE_URL: z
    .string()
    .url('INTERNAL_PLACES_SERVICE_URL must be a valid HTTP/HTTPS URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'INTERNAL_PLACES_SERVICE_URL must use HTTP or HTTPS protocol',
    )
    .optional(),

  INTERNAL_PLACES_SERVICE_TOKEN: z
    .string()
    .min(1, 'INTERNAL_PLACES_SERVICE_TOKEN is required')
    .refine(
      (token) => token !== 'your_internal_places_service_token_here',
      'INTERNAL_PLACES_SERVICE_TOKEN must be set to a valid token (not placeholder)',
    )
    .optional(),

  /*
   * ============================================================================
   * Google Places API Configuration
   * ============================================================================
   */
  GOOGLE_PLACES_API_KEY: z.string().optional(),

  /*
   * ============================================================================
   * OpenAI API Configuration
   * ============================================================================
   */
  OPENAI_API_KEY: z.string().optional(),

  /*
   * ============================================================================
   * Better Auth Configuration
   * ============================================================================
   */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
    .describe('Secret key for signing auth tokens (generate with: openssl rand -base64 32)'),
  BETTER_AUTH_URL: z
    .string()
    .url('BETTER_AUTH_URL must be a valid URL')
    .describe('Public URL of the application (e.g., https://huskit.app or http://localhost:5173)'),

  /*
   * ============================================================================
   * Google OAuth Configuration
   * ============================================================================
   */
  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, 'GOOGLE_CLIENT_ID is required')
    .describe('Google OAuth 2.0 Client ID from Google Cloud Console'),
  GOOGLE_CLIENT_SECRET: z
    .string()
    .min(1, 'GOOGLE_CLIENT_SECRET is required')
    .describe('Google OAuth 2.0 Client Secret from Google Cloud Console'),

  /*
   * ============================================================================
   * Feature Flags
   * ============================================================================
   * FR-011: PCC accessibility features (keyboard navigation, ARIA labels, high-contrast toasts)
   */
  ENABLE_PCC_ACCESSIBILITY: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true' || val === '1'),

  // Enable crawler agent telemetry and performance tracking
  ENABLE_CRAWLER_TELEMETRY: z
    .string()
    .default('true')
    .transform((val) => val.toLowerCase() === 'true' || val === '1'),

  /*
   * ============================================================================
   * Optional Configuration
   * ============================================================================
   */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Validated environment configuration type
 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Internal Places Service configuration subset
 */
export interface InternalPlacesServiceConfig {
  url: string;
  token: string;
  enabled: boolean;
}

/**
 * Feature flags configuration
 */
export interface FeatureFlags {
  pccAccessibility: boolean;
  crawlerTelemetry: boolean;
}

/**
 * Parse and validate environment variables
 *
 * @throws {Error} If required environment variables are missing or invalid
 */
function parseEnv(): EnvConfig {
  // In Remix, process.env is available server-side
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `  - ${field}: ${messages?.join(', ')}`)
      .join('\n');

    throw new Error(
      `Invalid environment configuration:\n${errorMessages}\n\n` +
        `Please check your .env.local file and ensure all required variables are set.\n` +
        `See .env.example for reference.`,
    );
  }

  return result.data;
}

// Singleton instance - parse once on module load
let envConfig: EnvConfig | null = null;

/**
 * Get validated environment configuration
 *
 * @returns Typed and validated environment configuration
 * @throws {Error} If environment validation fails
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    envConfig = parseEnv();
  }

  return envConfig;
}

/**
 * Get Internal Places Service configuration
 *
 * @returns Configuration for internal crawler service
 */
export function getInternalPlacesServiceConfig(): InternalPlacesServiceConfig | null {
  const env = getEnvConfig();

  if (!env.INTERNAL_PLACES_SERVICE_URL || !env.INTERNAL_PLACES_SERVICE_TOKEN) {
    return null;
  }

  return {
    url: env.INTERNAL_PLACES_SERVICE_URL,
    token: env.INTERNAL_PLACES_SERVICE_TOKEN,
    enabled: true, // Can be controlled by feature flag in future
  };
}

/**
 * Get feature flags configuration
 *
 * @returns Feature flags state
 */
export function getFeatureFlags(): FeatureFlags {
  const env = getEnvConfig();

  return {
    pccAccessibility: env.ENABLE_PCC_ACCESSIBILITY,
    crawlerTelemetry: env.ENABLE_CRAWLER_TELEMETRY,
  };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  const env = getEnvConfig();
  return env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  const env = getEnvConfig();
  return env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  const env = getEnvConfig();
  return env.NODE_ENV === 'test';
}

/**
 * Validate environment on module load (fail fast in development)
 */
// Check NODE_ENV directly to avoid circular dependency
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
  try {
    getEnvConfig();
  } catch (error) {
    // Only log in development, don't throw to avoid breaking HMR
    console.error('⚠️  Environment configuration validation failed:');
    console.error(error);
  }
}
