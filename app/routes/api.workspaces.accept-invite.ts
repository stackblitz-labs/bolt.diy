import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function acceptInviteAction({ request, context }: ActionFunctionArgs) {
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

    const { invitationToken } = (await request.json()) as {
      invitationToken: string;
    };

    if (!invitationToken) {
      return json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Get invitation
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .select('*')
      .eq('token', invitationToken)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return json({ error: 'Invitation not found or already used' }, { status: 404 });
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Check if email matches
    const { data: userProfile } = await supabase.from('users').select('email').eq('id', user.id).single();

    if (!userProfile || userProfile.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return json({ error: 'This invitation was sent to a different email address' }, { status: 403 });
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      /*
       * User is already a member - this shouldn't happen if flow is correct
       * But if it does, just update the invitation status to accepted
       */
      console.warn(
        `User ${user.id} is already a member of workspace ${invitation.workspace_id} but invitation ${invitation.id} is still pending. Updating invitation status.`,
      );
      await supabase.from('workspace_invitations').update({ status: 'accepted' }).eq('id', invitation.id);

      const { data: workspace } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', invitation.workspace_id)
        .single();

      return json({ workspace, message: 'Already a member' });
    }

    /*
     * IMPORTANT: Add user to workspace_members ONLY after all validations pass
     * This ensures users are only members after accepting invitations
     */
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (memberError) {
      console.error('Failed to add user to workspace_members:', memberError);
      return json({ error: memberError.message }, { status: 500 });
    }

    /*
     * Update invitation status to 'accepted' AFTER successfully adding user
     * This ensures data consistency: if member insert fails, invitation stays pending
     */
    const { error: updateError } = await supabase
      .from('workspace_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Failed to update invitation status:', updateError);

      /*
       * Don't fail the request, but log the error
       * The user is already a member, so the invitation status update is less critical
       */
    }

    // Get workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', invitation.workspace_id)
      .single();

    if (workspaceError) {
      return json({ error: workspaceError.message }, { status: 500 });
    }

    return json({ workspace, member });
  } catch (error) {
    console.error('Accept invite error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to accept invitation',
      },
      { status: 500 },
    );
  }
}

export const action = withSecurity(acceptInviteAction, {
  rateLimit: true,
  allowedMethods: ['POST'],
});
