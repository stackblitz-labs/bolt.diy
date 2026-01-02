import { useState } from 'react';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { Button } from '~/components/ui/Button';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

export function InvitationsList() {
  const { invitations = [], acceptInvitation, fetchInvitations, isLoading } = useWorkspace();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAccept = async (invitationToken: string, workspaceName: string) => {
    setAcceptingId(invitationToken);

    try {
      await acceptInvitation(invitationToken);
      toast.success(`Joined ${workspaceName}!`);
      await fetchInvitations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to accept invitation');
    } finally {
      setAcceptingId(null);
    }
  };

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="px-3 py-2 text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide">
        Pending Invitations
      </div>
      {invitations.map((invitation) => {
        const workspace = invitation.workspace as { id: string; name: string } | null;
        return (
          <div
            key={invitation.id}
            className={classNames(
              'px-3 py-2 text-sm rounded-md',
              'bg-bolt-elements-background-depth-1',
              'border border-bolt-elements-borderColor',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-bolt-elements-textPrimary truncate">
                  {workspace?.name || 'Workspace'}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">Invited to join workspace</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAccept(invitation.token, workspace?.name || 'workspace')}
                disabled={isLoading || acceptingId === invitation.token}
                className="shrink-0"
              >
                {acceptingId === invitation.token ? 'Accepting...' : 'Accept'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
