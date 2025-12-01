/**
 * Session utilities for Remix loaders and actions
 *
 * Provides helpers for accessing Better Auth sessions in server-side code.
 * Used by route guards and protected routes.
 *
 * Based on specs/002-better-auth/tasks.md (T017)
 */

import { auth } from './auth.server';

/**
 * Database connection error state
 * Used for fallback mode when database is unavailable
 */
let dbConnectionError: Error | null = null;
let dbConnectionHealthy = true;

/**
 * Check if database connection is healthy
 */
export function isDbConnectionHealthy(): boolean {
  return dbConnectionHealthy;
}

/**
 * Set database connection error state (for fallback mode)
 */
export function setDbConnectionError(error: Error | null) {
  dbConnectionError = error;
  dbConnectionHealthy = error === null;
}

/**
 * Get the current session from request headers
 *
 * @param request - Remix request object
 * @returns Session object if authenticated, null otherwise
 * @throws Error if database connection is unavailable and session is required
 */
export async function getSession(request: Request) {
  // If database is unavailable, return null (fallback mode)
  // This allows the app to continue in read-only mode
  if (!dbConnectionHealthy) {
    console.warn('[AUTH] Database connection unavailable - session check failed');
    return null;
  }

  try {
    return await auth.api.getSession({
      headers: request.headers,
    });
  } catch (error) {
    // If database connection error, enter fallback mode
    if (error instanceof Error && (error.message.includes('connection') || error.message.includes('database'))) {
      setDbConnectionError(error);
      console.error('[AUTH] Database connection error detected - entering fallback mode', error);
      return null;
    }
    throw error;
  }
}

/**
 * Get optional session (doesn't throw if not authenticated)
 *
 * @param request - Remix request object
 * @returns Session object if authenticated, null otherwise
 */
export async function getOptionalSession(request: Request) {
  return getSession(request);
}

/**
 * Export Session type for use in route loaders
 */
export type Session = Awaited<ReturnType<typeof getSession>>;

