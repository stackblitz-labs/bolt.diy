import { atom } from 'nanostores';

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  joined_at: string;
  user?: {
    id: string;
    email: string;
    username: string;
    display_name: string;
  };
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  expires_at: string;
  created_at: string;
  inviteUrl?: string;
  workspace?: { id: string; name: string; owner_id?: string } | null;
}

export interface WorkspaceOwner {
  id: string;
  email: string;
  username: string;
  display_name: string;
}

export interface WorkspacesResponse {
  workspaces: Workspace[];
  error?: string;
}

export interface CreateWorkspaceResponse {
  workspace: Workspace;
  error?: string;
}

export interface WorkspaceMembersResponse {
  owner: WorkspaceOwner | null;
  members: WorkspaceMember[];
  error?: string;
}

export interface InviteMemberResponse {
  invitation: WorkspaceInvitation;
  error?: string;
}

export interface AcceptInvitationResponse {
  workspace: Workspace;
  member?: WorkspaceMember;
  message?: string;
  error?: string;
}

export interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  isLoading: boolean;
}

const storage =
  typeof globalThis !== 'undefined' &&
  typeof globalThis.localStorage !== 'undefined' &&
  typeof globalThis.localStorage.getItem === 'function'
    ? globalThis.localStorage
    : null;

// Load initial state from localStorage
const savedWorkspace = storage ? storage.getItem('bolt_workspace') : null;
const initialState: WorkspaceState = savedWorkspace
  ? JSON.parse(savedWorkspace)
  : {
      currentWorkspace: null,
      workspaces: [],
      members: [],
      invitations: [],
      isLoading: false,
    };

export const workspaceState = atom<WorkspaceState>(initialState);

export const currentWorkspace = atom<Workspace | null>(initialState.currentWorkspace);
export const workspaces = atom<Workspace[]>(initialState.workspaces);

// Update derived atoms when workspace state changes
workspaceState.subscribe((state) => {
  currentWorkspace.set(state.currentWorkspace);
  workspaces.set(state.workspaces);

  // Persist to localStorage
  if (storage) {
    storage.setItem('bolt_workspace', JSON.stringify(state));
  }
});

export function setWorkspaceState(state: Partial<WorkspaceState>) {
  const current = workspaceState.get();
  const newState = { ...current, ...state };
  workspaceState.set(newState);
}

async function getAuthToken(): Promise<string | null> {
  const authState = (await import('./auth')).authState.get();
  return authState.session?.access_token || null;
}

export async function fetchWorkspaces() {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  setWorkspaceState({ isLoading: true });

  try {
    const response = await fetch('/api/workspaces', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: WorkspacesResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch workspaces');
    }

    setWorkspaceState({
      workspaces: data.workspaces || [],
      isLoading: false,
    });

    // If no current workspace is set, set the first one
    const current = workspaceState.get();

    if (!current.currentWorkspace && data.workspaces && data.workspaces.length > 0) {
      setWorkspaceState({ currentWorkspace: data.workspaces[0] });
    }

    return data.workspaces;
  } catch (error) {
    setWorkspaceState({ isLoading: false });
    throw error;
  }
}

export async function createWorkspace(name: string) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  setWorkspaceState({ isLoading: true });

  try {
    const response = await fetch('/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data: CreateWorkspaceResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create workspace');
    }

    const current = workspaceState.get();
    setWorkspaceState({
      workspaces: [data.workspace, ...current.workspaces],
      currentWorkspace: data.workspace,
      isLoading: false,
    });

    return data.workspace;
  } catch (error) {
    setWorkspaceState({ isLoading: false });
    throw error;
  }
}

export async function switchWorkspace(workspaceId: string) {
  const current = workspaceState.get();
  const workspace = current.workspaces.find((w) => w.id === workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  setWorkspaceState({ currentWorkspace: workspace });
  await fetchWorkspaceMembers(workspaceId);
}

export async function fetchWorkspaceMembers(workspaceId: string) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch(`/api/workspaces/members?workspaceId=${workspaceId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: WorkspaceMembersResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch members');
    }

    setWorkspaceState({
      members: data.members || [],
    });

    return { owner: data.owner, members: data.members };
  } catch (error) {
    console.error('Failed to fetch workspace members:', error);
    throw error;
  }
}

export async function inviteMember(workspaceId: string, email: string) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch('/api/workspaces/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ workspaceId, email }),
    });

    const data: InviteMemberResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send invitation');
    }

    return data.invitation;
  } catch (error) {
    throw error;
  }
}

export async function fetchInvitations() {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch('/api/workspaces/invitations', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = (await response.json()) as { invitations?: WorkspaceInvitation[]; error?: string };

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch invitations');
    }

    setWorkspaceState({
      invitations: data.invitations || [],
    });

    return data.invitations || [];
  } catch (error) {
    console.error('Failed to fetch invitations:', error);
    throw error;
  }
}

export async function acceptInvitation(invitationToken: string) {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const response = await fetch('/api/workspaces/accept-invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invitationToken }),
    });

    const data: AcceptInvitationResponse = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to accept invitation');
    }

    // Refresh workspaces list and invitations
    await fetchWorkspaces();
    await fetchInvitations();

    return data.workspace;
  } catch (error) {
    throw error;
  }
}
