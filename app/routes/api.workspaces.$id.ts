import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';

async function workspaceLoader({ request, context, params }: LoaderFunctionArgs) {
  try {
    const workspaceId = params.id;

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

    // Get workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (workspaceError) {
      return json({ error: workspaceError.message }, { status: 404 });
    }

    // Check if user has access to this workspace
    const isOwner = workspace.owner_id === user.id;
    const { data: member } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!isOwner && !member) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    return json({ workspace });
  } catch (error) {
    console.error('Workspace loader error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch workspace',
      },
      { status: 500 },
    );
  }
}

async function workspaceAction({ request, context, params }: ActionFunctionArgs) {
  const workspaceId = params.id;

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

  // Check if user is owner
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (workspace.owner_id !== user.id) {
    return json({ error: 'Only workspace owner can modify workspace' }, { status: 403 });
  }

  if (request.method === 'PATCH') {
    const { name } = (await request.json()) as { name?: string };

    if (name && typeof name === 'string' && name.trim().length > 0) {
      const { data: updatedWorkspace, error: updateError } = await supabase
        .from('workspaces')
        .update({ name: name.trim() })
        .eq('id', workspaceId)
        .select()
        .single();

      if (updateError) {
        return json({ error: updateError.message }, { status: 500 });
      }

      return json({ workspace: updatedWorkspace });
    }

    return json({ workspace });
  }

  if (request.method === 'DELETE') {
    const { error: deleteError } = await supabase.from('workspaces').delete().eq('id', workspaceId);

    if (deleteError) {
      return json({ error: deleteError.message }, { status: 500 });
    }

    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}

export const loader = withSecurity(workspaceLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

export const action = withSecurity(workspaceAction, {
  rateLimit: true,
  allowedMethods: ['PATCH', 'DELETE'],
});
