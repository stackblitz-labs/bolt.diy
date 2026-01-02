import { useState } from 'react';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { useAuth } from '~/lib/hooks/useAuth';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { InviteMember } from './InviteMember';
import { MembersList } from './MembersList';
import { toast } from 'react-toastify';

export function WorkspaceSettings() {
  const { currentWorkspace, createWorkspace, fetchWorkspaceMembers } = useWorkspace();
  const { user } = useAuth();
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const isOwner = currentWorkspace?.owner_id === user?.id;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newWorkspaceName.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      toast.success('Workspace created!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Create Workspace</h2>
        <form onSubmit={handleCreateWorkspace} className="space-y-4">
          <div>
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="My Workspace"
              required
              disabled={isCreating}
            />
          </div>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Workspace'}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">{currentWorkspace.name}</h2>
        <p className="text-sm text-bolt-elements-textSecondary">{isOwner ? 'You are the owner' : 'You are a member'}</p>
      </div>

      {isOwner && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">Invite Members</h3>
            {showInvite ? (
              <div className="space-y-4">
                <InviteMember
                  workspaceId={currentWorkspace.id}
                  onSuccess={() => {
                    setShowInvite(false);
                    fetchWorkspaceMembers(currentWorkspace.id).catch(console.error);
                  }}
                />
                <Button variant="ghost" onClick={() => setShowInvite(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowInvite(true)}>Invite Member</Button>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-3">Members</h3>
        <MembersList />
      </div>
    </div>
  );
}
