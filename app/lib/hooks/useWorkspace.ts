import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import {
  workspaceState,
  fetchWorkspaces,
  createWorkspace,
  switchWorkspace,
  fetchWorkspaceMembers,
  inviteMember,
  acceptInvitation,
  fetchInvitations,
} from '~/lib/stores/workspace';
import { useAuth } from './useAuth';

export function useWorkspace() {
  const { isAuthenticated } = useAuth();
  const state = useStore(workspaceState);

  useEffect(() => {
    if (isAuthenticated && state.workspaces.length === 0 && !state.isLoading) {
      fetchWorkspaces().catch(console.error);
      fetchInvitations().catch(console.error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (state.currentWorkspace) {
      fetchWorkspaceMembers(state.currentWorkspace.id).catch(console.error);
    }
  }, [state.currentWorkspace?.id]);

  return {
    currentWorkspace: state.currentWorkspace,
    workspaces: state.workspaces,
    members: state.members,
    invitations: state.invitations,
    isLoading: state.isLoading,
    fetchWorkspaces,
    createWorkspace,
    switchWorkspace,
    fetchWorkspaceMembers,
    inviteMember,
    acceptInvitation,
    fetchInvitations,
  };
}
