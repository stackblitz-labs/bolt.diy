/**
 * Supabase client utility for project tables
 *
 * Provides a configured Supabase client for server-side operations
 * on the projects, project_messages, and project_snapshots tables.
 */

import { createClient } from '@supabase/supabase-js';
import { createScopedLogger } from '~/utils/logger';
import { SupabaseRlsError } from '~/lib/errors/supabase-error';

const logger = createScopedLogger('SupabaseClient');

function truncateForLog(value: string, keep: number = 6): string {
  if (!value) {
    return '';
  }

  if (value.length <= keep * 2) {
    return value;
  }

  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}

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
    global: {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
    db: {
      schema: 'public',
    },
  });
}

/**
 * Get a Supabase client with user context for RLS policies
 * Sets the app.current_user_id setting for Row Level Security
 *
 * Uses atomic set+verify pattern to prevent race conditions with PgBouncer
 * connection pooling. The set_current_user RPC returns the value it set,
 * ensuring both operations happen in the same database call/connection.
 *
 * @throws {SupabaseRlsError} When RLS context cannot be established
 */
export async function createUserSupabaseClient(userId: string) {
  // Validate input
  if (!userId || typeof userId !== 'string') {
    throw SupabaseRlsError.invalidUserId();
  }

  const client = createSupabaseClient();

  /*
   * Set user context for RLS policies with atomic verification
   * The RPC returns the value it set, preventing connection pooling race conditions
   */
  try {
    const { data: returnedUserId, error } = await client.rpc('set_current_user', {
      user_id: userId,
    });

    if (error) {
      logger.error('Failed to set RLS user context', {
        userId: truncateForLog(userId),
        error: error.message,
        code: error.code,
        details: error.details,
      });
      throw SupabaseRlsError.contextSetFailed(userId, error);
    }

    // Verify using the return value (atomic - same connection as set)
    const verifyValue = typeof returnedUserId === 'string' ? returnedUserId : String(returnedUserId ?? '');

    if (!verifyValue) {
      logger.error('RLS context set returned empty value', { userId: truncateForLog(userId) });
      throw SupabaseRlsError.contextVerificationFailed(userId, userId, 'null');
    }

    if (verifyValue !== userId) {
      logger.error('RLS context verification mismatch', {
        expected: truncateForLog(userId),
        actual: truncateForLog(verifyValue),
      });
      throw SupabaseRlsError.contextVerificationFailed(userId, userId, verifyValue);
    }

    logger.debug(`Successfully set RLS user context: ${userId}`);

    return client;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error instanceof SupabaseRlsError) {
      throw error;
    }

    // Log the unexpected error and wrap it
    logger.error('Unexpected error setting RLS user context', { userId: truncateForLog(userId), error });
    throw SupabaseRlsError.contextSetFailed(userId, error);
  }
}

/**
 * Get a Supabase client for admin operations without user context
 * Used for operations that don't need RLS user restrictions (e.g., public snapshots)
 */
export async function createAdminSupabaseClient() {
  return createSupabaseClient();
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
