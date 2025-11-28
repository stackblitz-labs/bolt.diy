// app/routes/api.auth.logout.ts
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
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

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get Supabase client
    const supabase = getSupabaseClient(context?.env);

    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');

      // Set the session with the token
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: '', // We don't have refresh token from client
      });
    }

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase logout error:', error);

      // Don't fail logout if Supabase errors
    }

    return json({
      success: true,
      message: 'Đăng xuất thành công',
    });
  } catch (error) {
    console.error('Logout API error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
