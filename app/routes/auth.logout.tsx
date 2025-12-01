/**
 * Logout Action Route
 *
 * Handles user sign-out and redirects to home page.
 * Clears all sessions for the user via Better Auth.
 *
 * Based on specs/002-better-auth/tasks.md (T018)
 */

import { redirect, type ActionFunctionArgs } from '@remix-run/node';
import { auth } from '~/lib/auth/auth.server';

/**
 * Action: Handle sign-out request
 */
export async function action({ request }: ActionFunctionArgs) {
  // Better Auth handles sign-out via the API route
  // This route just redirects after sign-out
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('returnTo') || '/';

  // Sign out is handled by Better Auth's /sign-out endpoint
  // We redirect to the API route which will handle the sign-out
  return redirect(`/api/auth/sign-out?redirect=${encodeURIComponent(returnTo)}`);
}

