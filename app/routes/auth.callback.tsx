import { useEffect, useState } from 'react';

export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Authenticating with Google...');

  useEffect(() => {
    const handleCallback = async () => {
      console.log('=== Auth Callback Handler ===');
      console.log('Full URL:', window.location.href);

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      console.log('Access Token:', accessToken ? 'Present' : 'Missing');
      console.log('Refresh Token:', refreshToken ? 'Present' : 'Missing');
      console.log('Error:', error);

      if (error) {
        console.error('OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(errorDescription || 'Authentication failed');
        setTimeout(() => {
          window.location.href = '/?error=auth_failed';
        }, 2000);

        return;
      }

      if (!accessToken) {
        console.error('No access token in callback');
        setStatus('error');
        setMessage('No access token received');
        setTimeout(() => {
          window.location.href = '/?error=no_token';
        }, 2000);

        return;
      }

      try {
        const { createClient } = await import('@supabase/supabase-js');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
          console.error('Missing Supabase credentials in client');
          setStatus('error');
          setMessage('Missing configuration');
          setTimeout(() => {
            window.location.href = '/?error=missing_credentials';
          }, 2000);

          return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

        if (userError || !userData.user) {
          console.error('Failed to get user:', userError);
          setStatus('error');
          setMessage('Failed to get user information');
          setTimeout(() => {
            window.location.href = '/?error=user_fetch_failed';
          }, 2000);

          return;
        }

        console.log('User data:', userData.user);

        const user = {
          id: userData.user.id,
          email: userData.user.email!,
          name: userData.user.user_metadata?.full_name || userData.user.email!.split('@')[0],
          avatar: userData.user.user_metadata?.avatar_url,
        };

        localStorage.setItem('auth_token', accessToken);
        localStorage.setItem('auth_user', JSON.stringify(user));

        console.log('Saved to localStorage:', user);
        setStatus('success');
        setMessage('Authentication successful! Redirecting...');

        setTimeout(() => {
          window.location.replace('/');
        }, 1000);
      } catch (error) {
        console.error('Callback error:', error);
        setStatus('error');
        setMessage('An error occurred during authentication');
        setTimeout(() => {
          window.location.href = '/?error=callback_failed';
        }, 2000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="text-center backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md">
        {status === 'processing' && (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Authenticating with Google...</h2>
            <p className="text-gray-400">Please wait a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Success!</h2>
            <p className="text-gray-400">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/20 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Authentication Failed</h2>
            <p className="text-gray-400">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
