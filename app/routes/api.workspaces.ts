import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';

async function workspacesLoader({ request, context }: LoaderFunctionArgs) {
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

    console.log('user', user);

    if (userError || !user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    /*
     * Get user's workspaces (owned and member of)
     * Since RLS is disabled, we need to manually filter
     * Get workspaces where user is owner
     */
    const { data: ownedWorkspaces, error: ownedError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id);

    if (ownedError) {
      console.error('Error fetching owned workspaces:', ownedError);
      return json({ error: ownedError.message }, { status: 500 });
    }

    console.log(`User ${user.id} owns ${ownedWorkspaces?.length || 0} workspaces`);

    /*
     * Get workspaces where user is a member
     * First get the member records
     */
    const { data: memberRecords, error: membersError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);

    if (membersError) {
      return json({ error: membersError.message }, { status: 500 });
    }

    // If user has memberships, fetch the actual workspaces
    let memberWorkspaces: any[] = [];

    if (memberRecords && memberRecords.length > 0) {
      const workspaceIds = memberRecords.map((m) => m.workspace_id);
      console.log(`User ${user.id} is a member of ${workspaceIds.length} workspaces:`, workspaceIds);

      // Verify each membership has a corresponding accepted invitation
      for (const workspaceId of workspaceIds) {
        const { data: invitation } = await supabase
          .from('workspace_invitations')
          .select('id, status, email')
          .eq('workspace_id', workspaceId)
          .eq('email', user.email || '')
          .eq('status', 'accepted')
          .maybeSingle();

        if (!invitation) {
          console.warn(
            `WARNING: User ${user.id} (${user.email}) is a member of workspace ${workspaceId} but has no accepted invitation! This is a data integrity issue.`,
          );
        }
      }

      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds);

      if (workspacesError) {
        console.error('Error fetching member workspaces:', workspacesError);
      } else {
        memberWorkspaces = workspaces || [];
      }
    }

    // Combine and deduplicate workspaces
    const owned = ownedWorkspaces || [];
    const member = memberWorkspaces;
    const allWorkspaces = [...owned, ...member];

    // Deduplicate by id
    const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map((w) => [w.id, w])).values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return json({ workspaces: uniqueWorkspaces });
  } catch (error) {
    console.error('Workspaces loader error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch workspaces',
      },
      { status: 500 },
    );
  }
}

async function workspacesAction({ request, context }: ActionFunctionArgs) {
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

    const { name } = (await request.json()) as { name: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return json({ error: 'Workspace name is required' }, { status: 400 });
    }

    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        owner_id: user.id,
      })
      .select()
      .single();

    if (workspaceError) {
      return json({ error: workspaceError.message }, { status: 500 });
    }

    return json({ workspace });
  } catch (error) {
    console.error('Create workspace error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to create workspace',
      },
      { status: 500 },
    );
  }
}

export const loader = workspacesLoader;

export const action = workspacesAction;
