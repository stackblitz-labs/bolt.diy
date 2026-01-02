import { useState } from 'react';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { useAuth } from '~/lib/hooks/useAuth';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import * as RadixDialog from '@radix-ui/react-dialog';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { WorkspaceSettings } from './WorkspaceSettings';
import { InvitationsList } from './InvitationsList';
import { DialogRoot, DialogTitle, DialogClose } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';

export function WorkspaceSelector() {
  const { isAuthenticated } = useAuth();
  const {
    currentWorkspace,
    workspaces,
    switchWorkspace,
    createWorkspace,
    invitations = [],
    isLoading,
  } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSwitch = async (workspaceId: string) => {
    try {
      await switchWorkspace(workspaceId);
      setIsOpen(false);
      toast.success('Workspace switched');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch workspace');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newWorkspaceName.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      await createWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setShowCreate(false);
      setIsOpen(false);
      toast.success('Workspace created!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workspace');
    } finally {
      setIsCreating(false);
    }
  };

  // Only show workspace selector for authenticated users
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <RadixDropdown.Root open={isOpen} onOpenChange={setIsOpen}>
        <RadixDropdown.Trigger asChild>
          <Button variant="outline" className="flex items-center gap-2" disabled={isLoading}>
            <span className="i-ph:users w-4 h-4" />
            <span>{currentWorkspace?.name || 'Select workspace'}</span>
            <span className="i-ph:caret-down w-4 h-4" />
          </Button>
        </RadixDropdown.Trigger>

        <RadixDropdown.Portal>
          <RadixDropdown.Content
            className={classNames(
              'min-w-[250px] bg-bolt-elements-background rounded-md border border-bolt-elements-border p-1 shadow-lg',
              'z-50 max-h-[300px] overflow-y-auto',
            )}
            align="start"
          >
            {invitations && invitations.length > 0 && (
              <>
                <InvitationsList />
                <RadixDropdown.Separator className="h-px bg-bolt-elements-borderColor my-1" />
              </>
            )}

            {workspaces && workspaces.length > 0 && (
              <>
                {workspaces.map((workspace) => (
                  <RadixDropdown.Item
                    key={workspace.id}
                    className={classNames(
                      'px-3 py-2 text-sm rounded-md cursor-pointer',
                      currentWorkspace?.id === workspace.id
                        ? 'bg-bolt-elements-background-depth-1'
                        : 'hover:bg-bolt-elements-background-depth-1',
                      'text-bolt-elements-textPrimary',
                    )}
                    onClick={() => handleSwitch(workspace.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{workspace.name}</span>
                      {currentWorkspace?.id === workspace.id && (
                        <span className="i-ph:check w-4 h-4 text-bolt-elements-borderColorActive" />
                      )}
                    </div>
                  </RadixDropdown.Item>
                ))}
                <RadixDropdown.Separator className="h-px bg-bolt-elements-borderColor my-1" />
              </>
            )}

            {currentWorkspace && (
              <RadixDropdown.Item
                className={classNames(
                  'px-3 py-2 text-sm rounded-md cursor-pointer',
                  'hover:bg-bolt-elements-background-depth-1',
                  'text-bolt-elements-textPrimary',
                )}
                onClick={() => {
                  setShowSettings(true);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="i-ph:gear w-4 h-4" />
                  <span>Workspace Settings</span>
                </div>
              </RadixDropdown.Item>
            )}

            <RadixDropdown.Item
              className={classNames(
                'px-3 py-2 text-sm rounded-md cursor-pointer',
                'hover:bg-bolt-elements-background-depth-1',
                'text-bolt-elements-textPrimary',
              )}
              onClick={() => {
                setShowCreate(true);
                setIsOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="i-ph:plus w-4 h-4" />
                <span>Create Workspace</span>
              </div>
            </RadixDropdown.Item>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

      {/* Create Workspace Dialog */}
      <DialogRoot open={showCreate} onOpenChange={setShowCreate}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm" />
          <RadixDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md mx-4 focus:outline-none">
            <div className="relative bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-1 rounded-lg shadow-xl p-6 border border-bolt-elements-border">
              <div className="flex items-center justify-between mb-6">
                <DialogTitle className="text-bolt-elements-textPrimary">Create Workspace</DialogTitle>
                <DialogClose asChild>
                  <IconButton
                    icon="i-ph:x-bold"
                    className="absolute top-4 right-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors p-1 rounded-md hover:bg-bolt-elements-background-depth-2"
                    aria-label="Close"
                  />
                </DialogClose>
              </div>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label
                    htmlFor="workspace-name"
                    className="block text-sm font-medium text-bolt-elements-textPrimary mb-2"
                  >
                    Workspace Name
                  </label>
                  <Input
                    id="workspace-name"
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="My Workspace"
                    required
                    disabled={isCreating}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Workspace'}
                </Button>
              </form>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </DialogRoot>

      {/* Workspace Settings Dialog */}
      <DialogRoot open={showSettings} onOpenChange={setShowSettings}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm" />
          <RadixDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto focus:outline-none">
            <div className="relative bg-bolt-elements-bg-depth-1 dark:bg-bolt-elements-bg-depth-1 rounded-lg shadow-xl p-6 border border-bolt-elements-border">
              <div className="flex items-center justify-between mb-6">
                <DialogTitle className="text-bolt-elements-textPrimary">Workspace Settings</DialogTitle>
                <DialogClose asChild>
                  <IconButton
                    icon="i-ph:x-bold"
                    className="absolute top-4 right-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors p-1 rounded-md hover:bg-bolt-elements-background-depth-2"
                    aria-label="Close"
                  />
                </DialogClose>
              </div>
              <WorkspaceSettings />
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </DialogRoot>
    </>
  );
}
