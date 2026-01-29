import { redirect, json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useSearchParams, Form, Link, useActionData } from '@remix-run/react';
import { getOptionalSession } from '~/lib/auth/session.server';
import { auth } from '~/lib/auth/auth.server';
import { signIn } from '~/lib/auth/auth.client';
import { FaFacebook } from 'react-icons/fa';
import { MdEmail, MdLock } from 'react-icons/md';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const response = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
      asResponse: true,
    });

    if (!response.ok) {
      return json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return redirect('/app?login=true', {
      headers: response.headers,
    });
  } catch (error: any) {
    return json({ error: error.message || 'Invalid email or password' }, { status: 401 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getOptionalSession(request);

  if (session) {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get('returnTo') || '/app?login=true';
    throw redirect(returnTo);
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  return {
    error: error || null,
    errorDescription: errorDescription || null,
  };
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const returnTo = searchParams.get('returnTo') || '/app?login=true';

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

    return errorMessages[error] || error;
  };

  const errorMessage = actionData?.error || getErrorMessage(loaderData.error) || loaderData.errorDescription;

  const handleGoogleLogin = async () => {
    console.log('[Login] Google login button clicked');

    try {
      if (!signIn || !signIn.social) {
        console.error('[Login] signIn or signIn.social is undefined', { signIn });
        return;
      }

      console.log('[Login] Initiating social sign in with google');
      await signIn.social({
        provider: 'google',
        callbackURL: returnTo,
      });
      console.log('[Login] Social sign in initiated');
    } catch (error) {
      console.error('[Login] Error during Google login:', error);
    }
  };

  const handleFacebookLogin = () => {
    console.log('Facebook login clicked');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 font-sans text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="w-full max-w-[1000px] overflow-hidden rounded-[2rem] bg-white shadow-xl dark:bg-gray-900 dark:shadow-2xl">
        <div className="p-8 md:p-12 lg:p-16">
          <div className="mb-10 text-center">
            <h1 className="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Log In</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Login to Huskit to access your projects and continue building.
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/auth/signup"
                className="font-semibold text-black underline underline-offset-2 hover:text-gray-800 dark:text-white dark:hover:text-gray-200"
              >
                Sign Up
              </Link>
            </p>
          </div>

          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="flex-1">
              <Form method="post" className="space-y-5">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <MdEmail className="h-5 w-5" />
                  </div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    className="h-12 border-gray-200 bg-white pl-10 text-base shadow-sm focus-visible:ring-black dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus-visible:ring-white"
                    required
                  />
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <MdLock className="h-5 w-5" />
                  </div>
                  <Input
                    type="password"
                    name="password"
                    placeholder="Password"
                    className="h-12 border-gray-200 bg-white pl-10 text-base shadow-sm focus-visible:ring-black dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus-visible:ring-white"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="h-12 w-full rounded-xl bg-[#1a1b2e] text-base font-medium text-white hover:bg-[#2f3049] dark:bg-white dark:text-black dark:hover:bg-gray-200"
                >
                  Log In
                </Button>

                {errorMessage && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                    {errorMessage}
                  </div>
                )}
              </Form>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center lg:flex-col">
              <div className="absolute inset-0 flex items-center lg:inset-auto lg:h-full lg:w-full lg:flex-col lg:justify-center">
                <div className="h-px w-full bg-gray-200 lg:h-full lg:w-px dark:bg-gray-700"></div>
              </div>
              <div className="relative bg-white px-4 text-sm text-gray-400 dark:bg-gray-900">or</div>
            </div>

            {/* Social Login Section */}
            <div className="flex flex-1 flex-col justify-center space-y-4">
              <button
                onClick={handleGoogleLogin}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-base font-medium text-gray-700 shadow-sm transition-transform active:scale-[0.98] hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                <span>Continue with Google</span>
              </button>

              <button
                onClick={handleFacebookLogin}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] text-base font-medium text-white shadow-sm transition-transform active:scale-[0.98] hover:bg-[#166fe5]"
              >
                <FaFacebook className="h-5 w-5 text-white" />
                <span>Continue with Facebook</span>
              </button>

              <div className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
                By continuing, you agree to our{' '}
                <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                  Terms of Service
                </a>{' '}
                and acknowledge that you have read our{' '}
                <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">
                  Privacy Policy
                </a>
                .
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 py-4 text-center text-xs text-gray-400 dark:bg-gray-800/50 dark:text-gray-500">
          This site is protected by reCAPTCHA Enterprise.{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Google's Privacy Policy
          </a>{' '}
          and{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Terms of Service
          </a>{' '}
          apply.
        </div>
      </div>
    </div>
  );
}
