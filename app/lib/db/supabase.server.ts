/**
 * Supabase client utility for project tables
 *
 * Provides a configured Supabase client for server-side operations
 * on the projects, project_messages, and project_snapshots tables.
 */

import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from '~/lib/config/env.server';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SupabaseClient');

/**
 * Get a configured Supabase client for server-side operations
 * Uses service role key for admin operations (RLS policies still apply)
 */
export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing Supabase configuration: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY are required',
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get a Supabase client with user context for RLS policies
 * Sets the app.current_user_id setting for Row Level Security
 */
export async function createUserSupabaseClient(userId: string) {
  const client = createSupabaseClient();

  // Set user context for RLS policies
  try {
    await client.rpc('set_config', {
      parameter: 'app.current_user_id',
      value: userId,
    });
    logger.debug(`Set RLS user context: ${userId}`);
  } catch (error) {
    logger.error('Failed to set RLS user context', error);
  }

  return client;
}

/**
 * Singleton instance for admin operations
 */
let adminClient: ReturnType<typeof createSupabaseClient> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createSupabaseClient();
  }

  return adminClient;
}
