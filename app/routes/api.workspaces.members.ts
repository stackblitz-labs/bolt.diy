import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function membersLoader({ request, context }: LoaderFunctionArgs) {
  try {
    const workspaceId = new URL(request.url).searchParams.get('workspaceId');

    if (!workspaceId) {
      return json({ error: 'Workspace ID is required' }, { status: 400 });
    }

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

    // Check if user has access to this workspace
    const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();

    if (!workspace) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const isOwner = workspace.owner_id === user.id;

    // Check if user is a member (only if not owner)
    let isMember = false;

    if (!isOwner) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      isMember = !!member;
    }

    if (!isOwner && !isMember) {
      return json({ error: 'Access denied. You must be the owner or a member of this workspace.' }, { status: 403 });
    }

    // Get all members
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(
        `
        *,
        user:users(id, email, username, display_name)
      `,
      )
      .eq('workspace_id', workspaceId);

    if (membersError) {
      return json({ error: membersError.message }, { status: 500 });
    }

    // Get owner info
    const { data: owner } = await supabase
      .from('users')
      .select('id, email, username, display_name')
      .eq('id', workspace.owner_id)
      .single();

    return json({
      owner,
      members: members || [],
    });
  } catch (error) {
    console.error('Members loader error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch members',
      },
      { status: 500 },
    );
  }
}

export const loader = withSecurity(membersLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});
