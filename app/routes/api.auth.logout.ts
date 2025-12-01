import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

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
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const supabase = getSupabaseClient(context?.env);

    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');

      await supabase.auth.setSession({
        access_token: token,
        refresh_token: '',
      });
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Supabase logout error:', error);
    }

    return Response.json({
      success: true,
      message: 'Log out successfully',
    });
  } catch (error) {
    console.error('Logout API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
