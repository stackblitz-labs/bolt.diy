import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function signupAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { email, password, username, displayName } = (await request.json()) as {
      email: string;
      password: string;
      username: string;
      displayName?: string;
    };

    if (!email || !password || !username) {
      return json({ error: 'Email, password, and username are required' }, { status: 400 });
    }

    const supabase = getSupabaseAuthClientServer(context);

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Disable email confirmation
        data: {
          username,
          display_name: displayName || username,
        },
      },
    });

    if (authError) {
      return json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return json({ error: 'Failed to create user' }, { status: 500 });
    }

    /*
     * The database trigger should automatically create the user profile
     * Wait a moment for the trigger to execute
     */
    await new Promise((resolve) => setTimeout(resolve, 300));

    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = (context?.cloudflare?.env as any)?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey =
      (context?.cloudflare?.env as any)?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    let supabaseWithSession = supabase;
    let session = authData.session;

    // If no session was returned, try to sign in the user to get a session
    if (!session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session) {
        console.error('Failed to sign in after signup:', signInError);

        // Continue anyway - we can still create the profile using the trigger or service role
      } else {
        session = signInData.session;
        supabaseWithSession = createClient(supabaseUrl, supabaseAnonKey);
        await supabaseWithSession.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }
    } else {
      // Session exists, create a new client with the session
      supabaseWithSession = createClient(supabaseUrl, supabaseAnonKey);
      await supabaseWithSession.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    /*
     * Check if profile exists (created by trigger)
     * Use the original supabase client first to check (doesn't need session for SELECT with proper RLS)
     */
    const { data: existingProfile } = await supabase.from('users').select('id').eq('id', authData.user.id).single();

    if (existingProfile) {
      // Profile exists (created by trigger), update it with correct username/display_name if we have a session
      if (session) {
        const { error: updateError } = await supabaseWithSession
          .from('users')
          .update({
            username,
            display_name: displayName || username,
            email: authData.user.email!,
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error('Failed to update user profile:', updateError);

          // Continue anyway - profile exists with defaults
        }
      }
    } else {
      // Profile doesn't exist, trigger didn't fire - try to create it manually
      if (session) {
        // We have a session, can create it with RLS
        const { error: insertError } = await supabaseWithSession.from('users').insert({
          id: authData.user.id,
          email: authData.user.email!,
          username,
          display_name: displayName || username,
        });

        if (insertError) {
          console.error('Failed to create user profile (trigger did not fire):', insertError);

          // Don't fail signup - user can update profile later
        }
      } else {
        /*
         * No session and trigger didn't fire - log warning but don't fail
         * The user will need to sign in and update their profile
         */
        console.warn('User profile not created - trigger did not fire and no session available');
      }
    }

    /*
     * Create default workspace for the user
     * Use the session client to satisfy RLS policies
     */
    const { data: workspace, error: workspaceError } = await supabaseWithSession
      .from('workspaces')
      .insert({
        name: `${displayName || username}'s Workspace`,
        owner_id: authData.user.id,
      })
      .select()
      .single();

    if (workspaceError) {
      console.error('Failed to create default workspace:', workspaceError);

      // Don't fail signup if workspace creation fails, user can create it later
    }

    // Get session (use the one we have or try to get it)
    let finalSession = session;

    if (!finalSession) {
      const { data: sessionData } = await supabase.auth.getSession();
      finalSession = sessionData.session;
    }

    return json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        username,
        display_name: displayName || username,
      },
      session: finalSession,
      workspace: workspace || null,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to sign up',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(signupAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
