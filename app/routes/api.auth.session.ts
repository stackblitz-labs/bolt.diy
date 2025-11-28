// app/routes/api.auth.session.ts
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

// Helper to get Supabase client
function getSupabaseClient(env?: any) {
  const supabaseUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
  const supabaseKey = env?.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 },
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Get Supabase client
    const supabase = getSupabaseClient(context?.env);

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      console.error('Session check error:', error);
      return json(
        {
          authenticated: false,
          user: null,
        },
        { status: 401 },
      );
    }

    // Return authenticated user info
    return json({
      authenticated: true,
      user: {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.full_name || data.user.email!.split('@')[0],
        avatar: data.user.user_metadata?.avatar_url,
      },
      token,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return json(
      {
        error: 'Internal server error',
        authenticated: false,
        user: null,
      },
      { status: 500 },
    );
  }
}
