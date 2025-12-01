/**
 * Login Page Route
 *
 * Displays login page with Google OAuth sign-in button.
 * Redirects authenticated users to their destination.
 *
 * Based on specs/002-better-auth/tasks.md (T013)
 */

import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import { getOptionalSession } from '~/lib/auth/session.server';
import { GoogleSignInButton } from '~/components/auth/GoogleSignInButton';

/**
 * Loader: Check if user is already authenticated and handle OAuth errors
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getOptionalSession(request);

  // If already authenticated, redirect to returnTo or default destination
  if (session) {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo') || '/app';
    throw redirect(returnTo);
  }

  // Check for OAuth error parameters
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  return json({
    error: error || null,
    errorDescription: errorDescription || null,
  });
}

/**
 * Login Page Component
 */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof loader>();
  const returnTo = searchParams.get('returnTo') || '/app';

  // Map OAuth error codes to user-friendly messages
  const getErrorMessage = (error: string | null): string | null => {
    if (!error) return null;

    const errorMessages: Record<string, string> = {
      access_denied: 'You cancelled the sign-in process. Please try again if you want to continue.',
      invalid_request: 'The sign-in request was invalid. Please try again.',
      unauthorized_client: 'This application is not authorized. Please contact support.',
      unsupported_response_type: 'An error occurred during sign-in. Please try again.',
      invalid_scope: 'The requested permissions were denied. Please try again.',
      server_error: 'A server error occurred. Please try again later.',
      temporarily_unavailable: 'The authentication service is temporarily unavailable. Please try again later.',
    };

    return errorMessages[error] || 'An error occurred during sign-in. Please try again.';
  };

  const errorMessage = getErrorMessage(loaderData.error) || loaderData.errorDescription;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Sign in to Huskit</h1>
          <p className="mt-2 text-sm text-gray-600">
            Continue with your Google account to get started
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        <GoogleSignInButton callbackURL={returnTo} className="w-full" />

        <p className="text-center text-xs text-gray-500">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

