import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    const env = context?.env as any;
    const supabaseUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
    const supabaseKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    console.log('=== Google OAuth Init ===');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Has Supabase Key:', !!supabaseKey);

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        {
          error: 'Missing Supabase credentials',
          debug: { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey },
        },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(request.url);
    const redirectTo = `${url.protocol}//${url.host}/auth/callback`;

    console.log('Redirect URL:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('Google OAuth error:', error);
      return Response.json(
        {
          error: error.message || 'Unable to sign in with Google',
          details: error,
        },
        { status: 400 },
      );
    }

    if (!data.url) {
      console.error('No OAuth URL returned');
      return Response.json(
        {
          error: 'Unable to create OAuth URL',
        },
        { status: 400 },
      );
    }

    console.log('OAuth URL created successfully');

    return Response.json({ url: data.url });
  } catch (error) {
    console.error('Google OAuth API error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
