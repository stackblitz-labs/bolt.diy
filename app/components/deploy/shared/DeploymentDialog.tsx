import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import React from 'react';
import type { BaseRepository, DeploymentState } from './types';
import { SearchInput, EmptyState, Badge } from '~/components/ui';
import { formatSize } from '~/utils/formatSize';

interface DeploymentDialogProps<TRepo extends BaseRepository> {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  serviceIcon: React.ReactNode;
  state: DeploymentState;
  user: any;
  repositories: TRepo[];
  isConnected: boolean;
  onStateChange: (updates: Partial<DeploymentState>) => void;
  onDeploy: () => void;
  onShowAuth: () => void;
  AuthDialogComponent: React.ComponentType<any>;
  renderRepositoryItem?: (repo: TRepo) => React.ReactNode;
}

export function DeploymentDialog<TRepo extends BaseRepository>({
  isOpen,
  onClose,
  serviceName,
  serviceIcon,
  state,
  repositories,
  isConnected,
  onStateChange,
  onDeploy,
  onShowAuth,
  AuthDialogComponent: authDialogComponent,
  renderRepositoryItem,
}: DeploymentDialogProps<TRepo>) {
  const AuthDialog = authDialogComponent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDeploy();
  };

  // Success Dialog
  if (state.showSuccessDialog) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-1 rounded-lg shadow-xl z-50 w-full max-w-2xl max-h-[85vh] overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 space-y-6"
            >
              {/* Success Header */}
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                  <div className="i-ph:check-circle text-4xl text-green-500" />
                </div>
              </div>

              <div className="text-center">
                <Dialog.Title className="text-2xl font-semibold text-bolt-elements-textPrimary mb-2">
                  Successfully Deployed to {serviceName}!
                </Dialog.Title>
                <p className="text-bolt-elements-textSecondary">
                  Your project has been pushed to your {serviceName} repository.
                </p>
              </div>

              {/* Repository Link */}
              <div className="bg-bolt-elements-background-depth-2 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {serviceIcon}
                    <div>
                      <p className="text-sm text-bolt-elements-textSecondary">Repository</p>
                      <a
                        href={state.createdRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bolt-elements-textPrimary hover:text-bolt-elements-textAccent transition-colors font-medium"
                      >
                        {state.repoName}
                      </a>
                    </div>
                  </div>
                  <a
                    href={state.createdRepoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg transition-colors"
                  >
                    <span>View Repository</span>
                    <div className="i-ph:arrow-square-out" />
                  </a>
                </div>
              </div>

              {/* Files Pushed */}
              {state.pushedFiles.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
                    Files Pushed ({state.pushedFiles.length})
                  </h3>
                  <div className="bg-bolt-elements-background-depth-2 rounded-lg p-3 max-h-48 overflow-y-auto">
                    <div className="space-y-1">
                      {state.pushedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs text-bolt-elements-textSecondary py-1"
                        >
                          <span className="font-mono">{file.path}</span>
                          <span className="text-bolt-elements-textTertiary">{formatSize(file.size)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  // Main Deployment Dialog
  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-1 rounded-lg shadow-xl z-50 w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
              <div className="flex items-center gap-3">
                {serviceIcon}
                <Dialog.Title className="text-xl font-semibold text-bolt-elements-textPrimary">
                  Deploy to {serviceName}
                </Dialog.Title>
              </div>
              <Dialog.Close className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors">
                <div className="i-ph:x text-xl" />
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!isConnected ? (
                <EmptyState
                  icon="i-ph:link-break"
                  title={`Connect to ${serviceName}`}
                  description={`You need to connect your ${serviceName} account before deploying.`}
                  actionLabel={`Connect ${serviceName}`}
                  onAction={onShowAuth}
                />
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Repository Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      value={state.repoName}
                      onChange={(e) => onStateChange({ repoName: e.target.value })}
                      placeholder="my-awesome-project"
                      className="w-full px-3 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
                      required
                    />
                  </div>

                  {/* Privacy Toggle */}
                  <div className="flex items-center justify-between p-4 bg-bolt-elements-background-depth-2 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-bolt-elements-textPrimary">Private Repository</p>
                      <p className="text-xs text-bolt-elements-textSecondary mt-1">
                        Make this repository visible only to you
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.isPrivate}
                        onChange={(e) => onStateChange({ isPrivate: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-bolt-elements-background-depth-3 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-bolt-elements-focus rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-bolt-elements-button-primary-background"></div>
                    </label>
                  </div>

                  {/* Recent Repositories */}
                  {repositories.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-bolt-elements-textPrimary">
                          Recent Repositories ({repositories.length})
                        </h3>
                        <SearchInput
                          value={state.repoSearchQuery}
                          onChange={(e) => onStateChange({ repoSearchQuery: e.target.value })}
                          placeholder="Search repositories..."
                          className="w-64"
                        />
                      </div>
                      <div className="grid gap-2 max-h-64 overflow-y-auto">
                        {repositories.map((repo) =>
                          renderRepositoryItem ? (
                            renderRepositoryItem(repo)
                          ) : (
                            <div
                              key={repo.name}
                              className="p-3 bg-bolt-elements-background-depth-2 rounded-lg hover:bg-bolt-elements-background-depth-3 transition-colors cursor-pointer"
                              onClick={() => onStateChange({ repoName: repo.name })}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-bolt-elements-textPrimary font-medium">{repo.name}</span>
                                {repo.private !== undefined && (
                                  <Badge variant={repo.private ? 'warning' : 'success'}>
                                    {repo.private ? 'Private' : 'Public'}
                                  </Badge>
                                )}
                              </div>
                              {repo.description && (
                                <p className="text-xs text-bolt-elements-textSecondary mt-1 line-clamp-1">
                                  {repo.description}
                                </p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deploy Button */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-bolt-elements-borderColor">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={state.isLoading}
                      className="px-6 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-50 disabled:cursor-not-allowed text-bolt-elements-button-primary-text rounded-lg transition-colors flex items-center gap-2"
                    >
                      {state.isLoading ? (
                        <>
                          <div className="i-ph:spinner animate-spin" />
                          <span>Deploying...</span>
                        </>
                      ) : (
                        <>
                          <div className="i-ph:rocket-launch" />
                          <span>Deploy to {serviceName}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Auth Dialog */}
      <AuthDialog isOpen={state.showAuthDialog} onClose={() => onStateChange({ showAuthDialog: false })} />
    </>
  );
}
