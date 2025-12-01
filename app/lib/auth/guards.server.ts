/**
 * Route guard utilities for protected routes
 *
 * Provides helpers for requiring authentication in Remix loaders and actions.
 * Used to protect workspace routes under /app/**.
 *
 * Based on specs/002-better-auth/tasks.md (T024)
 */

import { redirect, json } from '@remix-run/node';
import { getSession } from './session.server';

/**
 * Require session for protected routes
 *
 * Throws redirect to login page if not authenticated.
 * Use in route loaders that require authentication.
 *
 * @param request - Remix request object
 * @returns Session object (never null)
 * @throws {Response} Redirect to login page if not authenticated
 */
export async function requireSession(request: Request) {
  const session = await getSession(request);

  if (!session) {
    const url = new URL(request.url);
    const returnTo = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/auth/login?returnTo=${returnTo}`);
  }

  return session;
}

/**
 * Require session for API routes (returns 401 JSON instead of redirect)
 *
 * Use in API route handlers that require authentication.
 *
 * @param request - Remix request object
 * @returns Session object (never null)
 * @throws {Response} 401 JSON error if not authenticated
 */
export async function requireSessionOrError(request: Request) {
  const session = await getSession(request);

  if (!session) {
    throw json(
      {
        error: 'Unauthorized',
        message: 'Session expired or invalid. Please sign in again.',
      },
      { status: 401 },
    );
  }

  return session;
}
