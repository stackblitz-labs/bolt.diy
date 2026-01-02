import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function inviteAction({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

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

    const { workspaceId, email } = (await request.json()) as {
      workspaceId: string;
      email: string;
    };

    if (!workspaceId || !email) {
      return json({ error: 'Workspace ID and email are required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check if user is workspace owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    if (workspace.owner_id !== user.id) {
      return json({ error: 'Only workspace owner can invite members' }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();

    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember) {
        return json({ error: 'User is already a member of this workspace' }, { status: 400 });
      }
    }

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvitation) {
      return json({ error: 'Invitation already sent to this email' }, { status: 400 });
    }

    // Create invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email: email.toLowerCase(),
        invited_by: user.id,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single();

    if (invitationError) {
      return json({ error: invitationError.message }, { status: 500 });
    }

    /*
     * TODO: Send email invitation (implement email service)
     * For now, return the invitation with token that can be used to accept
     */

    return json({
      invitation: {
        ...invitation,
        inviteUrl: `${request.headers.get('origin') || ''}/accept-invite?token=${invitation.token}`,
      },
    });
  } catch (error) {
    console.error('Invite error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to send invitation',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(inviteAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
