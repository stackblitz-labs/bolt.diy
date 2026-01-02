import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function logoutAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAuthClientServer(context);

    // Set the session from the token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Invalid session' }, { status: 401 });
    }

    // Sign out the user
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      return json({ error: signOutError.message }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to log out',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(logoutAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
