import { useEffect } from 'react';
import { useNavigate, useSearchParams } from '@remix-run/react';
import { getSupabase } from '~/lib/supabase/client';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from Supabase (this processes the OAuth callback)
        const { data, error } = await getSupabase().auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          // Redirect to home with error
          navigate('/?auth_error=' + encodeURIComponent(error.message));
          return;
        }

        // Get and validate URL parameters
        const redirectTo = searchParams.get('redirect');
        const intercomOptIn = searchParams.get('intercom') === 'true';
        const isSignupFlow = searchParams.get('isSignup') === 'true';
        const isEmailConfirm = searchParams.get('emailConfirm') === 'true';

        // Validate redirect URL to prevent open redirect attacks
        const isValidRedirect = (url: string | null): boolean => {
          if (!url || url === 'null' || url === '') {
            return false;
          }

          try {
            const decoded = decodeURIComponent(url);

            // Only allow relative URLs (starting with /) or same-origin URLs
            if (decoded.startsWith('/')) {
              // Ensure it doesn't try to escape to another domain with //
              return !decoded.startsWith('//');
            }

            // If it's an absolute URL, ensure it's same origin
            const redirectUrl = new URL(decoded, window.location.origin);
            return redirectUrl.origin === window.location.origin;
          } catch {
            // Invalid URL format
            return false;
          }
        };

        // If user is authenticated, handle analytics tracking
        if (data.session?.user) {
          const user = data.session.user;

          // Intercom user addition (if opted in during signup or email confirmation of new user)
          if ((intercomOptIn || isEmailConfirm) && user.email) {
            // Validate email format before sending to API
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
            if (emailRegex.test(user.email)) {
              // Make this call non-blocking so it doesn't affect the OAuth flow
              fetch('/api/intercom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, name: user.user_metadata.full_name }),
              }).catch((err) => {
                console.error('Failed to add user to Intercom (non-blocking)', err);
                // Don't log the actual error details to prevent information disclosure
              });
            }
          }

          // Analytics tracking
          if (window.analytics && user) {
            const signInMethod = isEmailConfirm ? 'email' : isSignupFlow ? 'google_oauth' : 'google_oauth';

            window.analytics.identify(user.id, {
              email: user.email,
              lastSignIn: new Date().toISOString(),
              signInMethod,
            });

            // Check if this is a signup flow, email confirmation, or if it's a new user
            const isNewUser =
              isSignupFlow || isEmailConfirm || new Date(user.created_at).getTime() > Date.now() - 60000; // Within last minute

            if (isNewUser) {
              // Track as signup
              window.analytics.track('User Signed Up', {
                method: isEmailConfirm ? 'email' : 'google_oauth',
                email: user.email,
                userId: user.id,
                timestamp: new Date().toISOString(),
              });

              window.analytics.identify(user.id, {
                email: user.email,
                signupMethod: isEmailConfirm ? 'email' : 'google_oauth',
                signupDate: new Date().toISOString(),
                createdAt: user.created_at,
              });
            }
          }

          // LogRocket identification
          if (window.LogRocket && user) {
            const signInMethod = isEmailConfirm ? 'email' : isSignupFlow ? 'google_oauth' : 'google_oauth';
            window.LogRocket.identify(user.id, {
              email: user.email,
              lastSignIn: new Date().toISOString(),
              signInMethod,
            });
          }
        }

        // Navigate to the appropriate page
        if (data.session && isValidRedirect(redirectTo)) {
          const decodedRedirect = decodeURIComponent(redirectTo!);
          // Remove sensitive information from logs
          console.log('Authentication successful, redirecting user');
          navigate(decodedRedirect);
        } else {
          // Log security event if invalid redirect attempted
          if (redirectTo && redirectTo !== 'null' && redirectTo !== '') {
            console.warn('Invalid redirect URL attempted:', redirectTo.substring(0, 50) + '...');
          }
          // Fallback to home if no valid redirect specified
          navigate('/');
        }
      } catch (error) {
        console.error('Unexpected auth callback error:', error);
        navigate('/?auth_error=' + encodeURIComponent('Authentication failed'));
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-bolt-elements-background-depth-1 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-lg">
          <div className="w-8 h-8 border-2 border-bolt-elements-borderColor/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
        <h2 className="text-xl font-semibold text-bolt-elements-textHeading mb-2">Completing sign in...</h2>
        <p className="text-bolt-elements-textSecondary">Please wait while we finish signing you in.</p>
      </div>
    </div>
  );
}
