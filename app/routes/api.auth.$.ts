/**
 * Better Auth catch-all route handler
 *
 * Handles all Better Auth API routes (sign-in, sign-out, callback, etc.)
 * using Remix's catch-all route pattern ($).
 *
 * Based on specs/002-better-auth/research.md
 */

import { auth } from '~/lib/auth/auth.server';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/cloudflare';

/**
 * Handle GET requests for Better Auth routes
 */
export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

/**
 * Handle POST requests for Better Auth routes
 */
export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}

