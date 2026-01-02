import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function sessionLoader({ request, context }: LoaderFunctionArgs) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ user: null, session: null });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAuthClientServer(context);

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ user: null, session: null });
    }

    // Get session first
    const { data: sessionData } = await supabase.auth.getSession();

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

    // Get user profile (use maybeSingle to avoid error if profile doesn't exist)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // If profile doesn't exist, try to create it (trigger might have failed)
    let finalProfile = userProfile;

    if (!userProfile && !profileError) {
      const { error: createError } = await supabase.from('users').insert({
        id: user.id,
        email: user.email || '',
        username: user.email?.split('@')[0] || 'user',
        display_name: user.email?.split('@')[0] || 'User',
      });

      if (createError) {
        console.error('Failed to create user profile:', createError);
      } else {
        // Fetch the newly created profile
        const { data: newProfile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();

        if (newProfile) {
          finalProfile = newProfile;
        }
      }
    }

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Failed to fetch user profile:', profileError);
    }

    return json({
      user: finalProfile || {
        id: user.id,
        email: user.email,
        username: user.email?.split('@')[0] || 'user',
        display_name: user.email?.split('@')[0] || 'User',
      },
      session: sessionData.session,
      workspaces: workspaces || [],
    });
  } catch (error) {
    console.error('Session error:', error);
    return json({ user: null, session: null });
  }
}

export const loader = withSecurity(sessionLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});
