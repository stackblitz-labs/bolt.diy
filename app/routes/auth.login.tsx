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
    if (!error) {
      return null;
    }

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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-accent-50 via-accent-100/40 to-white dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent-200/30 via-transparent to-transparent dark:from-accent-900/20" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent-200/30 via-transparent to-transparent dark:from-accent-900/20" />

      <main className="w-full max-w-5xl overflow-hidden rounded-3xl border border-bolt-elements-borderColor bg-white/90 shadow-2xl backdrop-blur-md dark:border-bolt-elements-borderColor dark:bg-gray-950/70">
        <div className="px-8 pb-4 pt-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-bolt-elements-textPrimary md:text-5xl">Sign in</h1>
          <p className="mt-3 text-lg text-bolt-elements-textSecondary">
            Continue with your Google account to get started.
          </p>
        </div>

        <div className="p-8 md:p-12 lg:px-20 lg:pb-16">
          <div className="flex flex-col items-stretch gap-10 md:flex-row lg:gap-16">
            <div className="w-full md:w-1/2">
              <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 transition-theme">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Welcome back</h2>
                  <p className="text-sm text-bolt-elements-textSecondary">
                    Sign in to Huskit to access your projects and continue building.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  {errorMessage && (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
                      role="alert"
                    >
                      <div className="flex gap-3">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center">
                          <svg
                            className="h-5 w-5 text-red-500 dark:text-red-300"
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
                        <p className="text-sm leading-relaxed">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  <GoogleSignInButton
                    callbackURL={returnTo}
                    className="w-full shadow-soft transition-all duration-200 hover:-translate-y-0.5"
                  />

                  <p className="text-center text-xs text-bolt-elements-textTertiary">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-center md:w-px md:flex-col">
              <div className="h-px w-full border-t border-bolt-elements-borderColor md:h-full md:w-px md:border-l md:border-t-0" />
              <span className="relative z-10 -mt-3 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-4 py-2 text-sm font-medium text-bolt-elements-textTertiary md:mt-0">
                or
              </span>
            </div>

            <div className="flex w-full flex-col justify-center gap-5 md:w-1/2">
              <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-6 transition-theme">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Why Huskit?</h2>
                  <p className="text-sm text-bolt-elements-textSecondary">
                    Build and iterate faster with an AI-powered workflow.
                  </p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-bolt-elements-textSecondary">
                  <li className="flex items-start gap-3">
                    <span className="i-ph:check-circle-bold mt-0.5 text-lg text-bolt-elements-icon-success" />
                    <span>Generate, refine, and deploy websites in minutes.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="i-ph:check-circle-bold mt-0.5 text-lg text-bolt-elements-icon-success" />
                    <span>Keep everything in sync with your project history.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="i-ph:check-circle-bold mt-0.5 text-lg text-bolt-elements-icon-success" />
                    <span>Work in light or dark mode with consistent styling.</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 p-4 text-center text-xs text-bolt-elements-textTertiary transition-theme">
                <div className="flex items-center justify-center gap-2">
                  <span className="i-ph:shield-check-bold text-base text-bolt-elements-icon-secondary" />
                  <span>Protected by Google OAuth. We never see your password.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
