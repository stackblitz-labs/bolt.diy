import { redirect, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  console.log('=== Auth Callback ===');
  console.log('Code:', code ? 'Present' : 'Missing');
  console.log('Error:', error);
  console.log('Error Description:', errorDescription);
  console.log('Full URL:', url.href);

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth provider error:', error, errorDescription);
    return redirect(`/?error=auth_failed&detail=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    console.error('No authorization code in callback');
    return redirect('/?error=no_code');
  }

  try {
    const env = context?.env as any;
    const supabaseUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
    const supabaseKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    console.log('Using Supabase URL:', supabaseUrl);

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials in callback');
      return redirect('/?error=server_config');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Exchange code for session
    console.log('Exchanging code for session...');

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Exchange error:', exchangeError);
      return redirect(`/?error=exchange_failed&detail=${encodeURIComponent(exchangeError.message)}`);
    }

    if (!data.session || !data.user) {
      console.error('No session or user after exchange');
      return redirect('/?error=no_session');
    }

    console.log('Session created for user:', data.user.email);

    // Return HTML that saves to localStorage and redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Đăng nhập thành công</title>
          <meta charset="UTF-8">
          <style>
            body {
              margin: 0;
              padding: 0;
              background: linear-gradient(to bottom right, #1f2937, #111827);
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .success-icon {
              width: 64px;
              height: 64px;
              margin: 0 auto 1.5rem;
              border-radius: 50%;
              background: #10b981;
              display: flex;
              align-items: center;
              justify-content: center;
              animation: scaleIn 0.3s ease-out;
            }
            .success-icon svg {
              width: 32px;
              height: 32px;
              color: white;
            }
            .spinner {
              display: inline-block;
              width: 48px;
              height: 48px;
              border: 3px solid rgba(59, 130, 246, 0.3);
              border-top-color: #3b82f6;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 1rem;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            @keyframes scaleIn {
              from { transform: scale(0); }
              to { transform: scale(1); }
            }
            h2 {
              margin: 0 0 0.5rem 0;
              font-size: 1.5rem;
              font-weight: 600;
            }
            p {
              margin: 0;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2>Đăng nhập thành công!</h2>
            <p>Đang chuyển hướng...</p>
            <div class="spinner" style="margin-top: 1.5rem;"></div>
          </div>
          <script>
            (function() {
              try {
                const authData = {
                  token: ${JSON.stringify(data.session.access_token)},
                  user: ${JSON.stringify({
                    id: data.user.id,
                    email: data.user.email,
                    name:
                      data.user.user_metadata?.full_name ||
                      data.user.user_metadata?.name ||
                      data.user.email?.split('@')[0] ||
                      'User',
                    avatar: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
                  })}
                };
                
                console.log('Saving auth data to localStorage...');
                localStorage.setItem('auth_token', authData.token);
                localStorage.setItem('auth_user', JSON.stringify(authData.user));
                console.log('Auth data saved successfully');
                
                // Small delay to show success message
                setTimeout(function() {
                  window.location.href = '/';
                }, 800);
              } catch (e) {
                console.error('Failed to save auth data:', e);
                window.location.href = '/?error=save_failed';
              }
            })();
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    console.error('Callback error:', error);
    return redirect(
      `/?error=callback_failed&detail=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`,
    );
  }
}

export default function AuthCallback() {
  return null;
}
