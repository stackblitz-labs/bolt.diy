import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function loginAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { email, password } = (await request.json()) as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return json({ error: 'Email and password are required' }, { status: 400 });
    }

    const supabase = getSupabaseAuthClientServer(context);

    // Sign in the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return json({ error: authError.message }, { status: 401 });
    }

    if (!authData.user) {
      return json({ error: 'Failed to authenticate' }, { status: 500 });
    }

    // Get user profile (use maybeSingle to avoid error if profile doesn't exist)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .maybeSingle();

    // If profile doesn't exist, try to create it (trigger might have failed)
    let finalProfile = userProfile;

    if (!userProfile && !profileError) {
      const { error: createError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: authData.user.email || '',
        username: authData.user.email?.split('@')[0] || 'user',
        display_name: authData.user.email?.split('@')[0] || 'User',
      });

      if (createError) {
        console.error('Failed to create user profile:', createError);
      } else {
        // Fetch the newly created profile
        const { data: newProfile } = await supabase.from('users').select('*').eq('id', authData.user.id).maybeSingle();

        if (newProfile) {
          finalProfile = newProfile;
        }
      }
    }

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Failed to fetch user profile:', profileError);
    }

    /*
     * Get user's workspaces
     * RLS policies will automatically filter based on user_has_workspace_access function
     */
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspacesError) {
      console.error('Failed to fetch workspaces:', workspacesError);
    }

    return json({
      user: finalProfile || {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.email?.split('@')[0] || 'user',
        display_name: authData.user.email?.split('@')[0] || 'User',
      },
      session: authData.session,
      workspaces: workspaces || [],
    });
  } catch (error) {
    console.error('Login error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to log in',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(loginAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
