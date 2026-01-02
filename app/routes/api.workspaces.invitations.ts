import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function invitationsLoader({ request, context }: LoaderFunctionArgs) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAuthClientServer(context);

    // Get user from token
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's email
    const { data: userProfile } = await supabase.from('users').select('email').eq('id', user.id).single();

    if (!userProfile) {
      return json({ invitations: [] });
    }

    // Get pending invitations for this user's email
    const { data: invitations, error: invitationsError } = await supabase
      .from('workspace_invitations')
      .select('*, workspace:workspaces(id, name, owner_id)')
      .eq('email', userProfile.email.toLowerCase())
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (invitationsError) {
      return json({ error: invitationsError.message }, { status: 500 });
    }

    return json({ invitations: invitations || [] });
  } catch (error) {
    console.error('Invitations loader error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch invitations',
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(invitationsLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});
