import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '~/lib/hooks/useSettings';
import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';

interface UpdateProgress {
  stage: 'fetch' | 'pull' | 'install' | 'build' | 'complete';
  message: string;
  progress?: number;
  error?: string;
  details?: {
    changedFiles?: string[];
    additions?: number;
    deletions?: number;
    commitMessages?: string[];
    totalSize?: string;
    currentCommit?: string;
    currentBranch?: string;
    latestCommitMessage?: string;
    remoteCommit?: string;
    updateReady?: boolean;
    changelog?: string;
  };
}

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-purple-500"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.3 }}
    />
  </div>
);

const UpdateProgressDisplay = ({ progress }: { progress: UpdateProgress }) => (
  <div className="mt-4 space-y-2">
    <div className="flex justify-between items-center">
      {progress.message.toLowerCase().includes('completed') ? (
        <div className="flex items-center gap-2">
          <div className="i-ph:check-circle text-green-500 w-4 h-4" />
          <span className="text-sm font-medium text-green-500">{progress.message}</span>
        </div>
      ) : (
        <span className="text-sm font-medium text-bolt-elements-textPrimary">{progress.message}</span>
      )}
      {progress.progress !== undefined && (
        <span className="text-sm text-bolt-elements-textSecondary">{progress.progress}%</span>
      )}
    </div>
    {progress.progress !== undefined && <ProgressBar progress={progress.progress} />}
    {progress.details && (
      <div className="mt-2 text-sm text-bolt-elements-textSecondary">
        {progress.details.changedFiles && progress.details.changedFiles.length > 0 && (
          <div className="mt-4">
            <div className="font-medium mb-2">Changed Files:</div>
            <div className="space-y-2">
              {['Modified', 'Added', 'Deleted'].map((type) => {
                const filesOfType = progress.details?.changedFiles?.filter((file) => file.startsWith(type)) || [];

                if (filesOfType.length === 0) {
                  return null;
                }

                return (
                  <div key={type} className="space-y-1">
                    <div
                      className={classNames('text-sm font-medium', {
                        'text-blue-500': type === 'Modified',
                        'text-green-500': type === 'Added',
                        'text-red-500': type === 'Deleted',
                      })}
                    >
                      {type} ({filesOfType.length})
                    </div>
                    <div className="pl-4 space-y-1">
                      {filesOfType.map((file, index) => {
                        const fileName = file.split(': ')[1];

                        return (
                          <div key={index} className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                            <div
                              className={classNames('w-4 h-4', {
                                'i-ph:pencil-simple': type === 'Modified',
                                'i-ph:plus': type === 'Added',
                                'i-ph:trash': type === 'Deleted',
                                'text-blue-500': type === 'Modified',
                                'text-green-500': type === 'Added',
                                'text-red-500': type === 'Deleted',
                              })}
                            />
                            <span className="font-mono text-xs">{fileName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {progress.details.totalSize && (
          <div className="mt-2 flex items-center gap-2">
            <div className="i-ph:file text-purple-500 w-4 h-4" />
            Total size: {progress.details.totalSize}
          </div>
        )}
        {progress.details.additions !== undefined && progress.details.deletions !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <div className="i-ph:git-diff text-purple-500 w-4 h-4" />
            Changes: <span className="text-green-500">+{progress.details.additions}</span>{' '}
            <span className="text-red-500">-{progress.details.deletions}</span>
          </div>
        )}
      </div>
    )}
  </div>
);

const UpdateTab = () => {
  const { isLatestBranch } = useSettings();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateProgress, setUpdateProgress] = useState<UpdateProgress | null>(null);
  const [lastUpdateCheck, setLastUpdateCheck] = useState(() => {
    const stored = localStorage.getItem('last_update_check');
    return stored ? JSON.parse(stored) : null;
  });
  const [updateInfo, setUpdateInfo] = useState<{
    currentCommit?: string;
    currentBranch?: string;
    latestCommitMessage?: string;
    remoteCommit?: string;
    updateReady?: boolean;
    changelog?: string;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem('last_update_check', JSON.stringify(lastUpdateCheck));
  }, [lastUpdateCheck]);

  const checkForUpdates = useCallback(
    async (silent = false) => {
      if (isChecking) {
        return;
      }

      setIsChecking(true);

      if (!silent) {
        setError(null);
        setUpdateProgress(null);
      }

      try {
        // Fetch update information from the API
        const response = await fetch('/api/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            branch: isLatestBranch ? 'main' : 'stable',
            checkOnly: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Update check failed (${response.status}): ${response.statusText}`);
        }

        const updateData = (await response.json()) as UpdateProgress;

        // Extract update information
        if (updateData.details) {
          setUpdateInfo({
            currentCommit: updateData.details.currentCommit,
            currentBranch: updateData.details.currentBranch,
            latestCommitMessage: updateData.details.latestCommitMessage,
            remoteCommit: updateData.details.remoteCommit,
            updateReady: updateData.details.updateReady,
            changelog: updateData.details.changelog,
          });
        }

        // Set update progress
        setUpdateProgress(updateData);

        if (!silent) {
          toast.info(
            'Updates must be performed manually in a server environment. Please follow the instructions below.',
          );
        }

        setLastUpdateCheck(Date.now());
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Update check error:', error);

        if (!silent) {
          setError(message);
          toast.error('Update check failed. Please follow the manual update instructions below.');
        }

        logStore.logWarning('Update Check Failed', {
          type: 'update',
          message,
        });
      } finally {
        setIsChecking(false);
      }
    },
    [isLatestBranch, isChecking],
  );

  useEffect(() => {
    if (!isLatestBranch) {
      return undefined;
    }

    const checkInterval = 6 * 60 * 60 * 1000; // 6 hours
    const shouldCheck = !lastUpdateCheck || Date.now() - lastUpdateCheck > checkInterval;

    if (shouldCheck) {
      void checkForUpdates(true);
    }

    const intervalId = setInterval(() => {
      void checkForUpdates(true);
    }, checkInterval);

    return () => clearInterval(intervalId);
  }, [isLatestBranch, lastUpdateCheck, checkForUpdates]);

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="i-ph:arrow-circle-up text-lg text-purple-500" />
        <div className="flex-1">
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Updates</h3>
          <p className="text-sm text-bolt-elements-textSecondary">Check for and manage application updates</p>
        </div>
      </motion.div>

      {/* Automatic Update Card */}
      <motion.div
        className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="i-ph:gear text-lg text-purple-500" />
            <div>
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Automatic Updates</h3>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Coming Soon</p>
            </div>
          </div>
          <button
            disabled
            className={classNames(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-not-allowed opacity-50',
              'bg-gray-200 dark:bg-gray-700',
            )}
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </div>

        <div className="text-sm text-bolt-elements-textSecondary mb-4">
          <p>
            Automatic updates are not yet available in this version. For now, please use the manual update process below
            to keep your application up to date.
          </p>
          <p className="mt-2 text-xs">
            <span className="text-purple-500 dark:text-purple-400">Note:</span> This feature will allow automatic
            updates when new changes are detected on the {isLatestBranch ? 'main' : 'stable'} branch.
          </p>
          {!isLatestBranch && (
            <div className="mt-4 p-3 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <div className="i-ph:info" />
                <span>
                  Enable "Main Branch Updates" in Features tab to receive updates from the main development branch.
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Manual Update Instructions Card */}
      <motion.div
        className="p-6 rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="i-ph:terminal text-lg text-purple-500" />
            <div>
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Manual Update Process</h3>
              <p className="text-xs text-bolt-elements-textTertiary mt-0.5">
                Current branch:{' '}
                <span className="font-medium text-purple-500 dark:text-purple-400">
                  {updateInfo?.currentBranch || (isLatestBranch ? 'main' : 'stable')}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={() => checkForUpdates(false)}
            disabled={isChecking}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-[#F5F5F5] dark:bg-[#1A1A1A]',
              'text-bolt-elements-textPrimary',
              'hover:bg-gray-100 dark:hover:bg-[#252525]',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isChecking ? (
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="i-ph:arrows-clockwise w-4 h-4"
                />
                Checking...
              </div>
            ) : (
              <>
                <div className="i-ph:arrows-clockwise w-4 h-4" />
                Check for Updates
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {updateProgress && <UpdateProgressDisplay progress={updateProgress} />}

        {updateInfo && (
          <div className="mb-6 text-sm">
            <div className="flex items-center gap-2 text-bolt-elements-textSecondary mb-2">
              <div className="i-ph:git-commit text-purple-500" />
              <span>Repository Status:</span>
            </div>
            <div className="bg-[#F5F5F5] dark:bg-[#151515] rounded-lg p-3 space-y-2 border border-transparent dark:border-[#1A1A1A]">
              <div className="flex items-center gap-2">
                <span className="text-bolt-elements-textTertiary">Current:</span>{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded text-bolt-elements-textPrimary">
                  {updateInfo.currentCommit || 'unknown'}
                </code>
              </div>
              {updateInfo.currentBranch && updateInfo.currentBranch !== 'unknown' && (
                <div className="flex items-center gap-2">
                  <span className="text-bolt-elements-textTertiary">Branch:</span>
                  <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded text-bolt-elements-textPrimary">
                    {updateInfo.currentBranch}
                  </code>
                </div>
              )}
              {updateInfo.latestCommitMessage && (
                <div className="flex flex-col gap-1">
                  <span className="text-bolt-elements-textTertiary">Latest commit:</span>
                  <div className="text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-1.5 rounded font-mono whitespace-pre-wrap text-bolt-elements-textPrimary">
                    {updateInfo.latestCommitMessage}
                  </div>
                </div>
              )}
              {updateInfo.changelog && (
                <div className="pt-2 border-t border-[#E5E5E5] dark:border-[#252525] mt-2">
                  <div className="text-xs text-bolt-elements-textTertiary whitespace-pre-wrap font-mono">
                    {updateInfo.changelog}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-bolt-elements-textSecondary mb-4">
          <p>Follow these steps to update manually:</p>
        </div>

        <div className="bg-[#F5F5F5] dark:bg-[#151515] rounded-lg p-4 border border-transparent dark:border-[#1A1A1A]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="i-ph:folder-simple text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">1. Navigate to the project directory</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:git-branch text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                2. Configure upstream remote:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  git remote add upstream https://github.com/stackblitz-labs/bolt.diy.git
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:git-branch text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                3. Fetch updates:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  git fetch upstream
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:git-pull-request text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                4. Set up branch tracking:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  git checkout {isLatestBranch ? 'main' : 'stable'} && git branch --set-upstream-to=upstream/
                  {isLatestBranch ? 'main' : 'stable'}
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:git-pull-request text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                5. Pull updates:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  git pull upstream {updateInfo?.currentBranch || (isLatestBranch ? 'main' : 'stable')}
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:package text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                6. Install dependencies:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  pnpm install
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="i-ph:hammer text-purple-500" />
              <p className="text-sm text-bolt-elements-textPrimary">
                7. Build the project:{' '}
                <code className="font-mono text-xs bg-[#E5E5E5] dark:bg-[#1A1A1A] px-2 py-0.5 rounded">
                  pnpm run build
                </code>
              </p>
            </div>
          </div>
        </div>

        {updateProgress?.details && updateProgress.details.changelog && (
          <div className="mt-6 border-t border-bolt-elements-borderLight dark:border-[#252525] pt-4">
            <h3 className="text-lg font-medium mb-3 text-bolt-elements-textPrimary">Update Information</h3>
            <div className="mb-4">
              <div className="bg-[#F5F5F5] dark:bg-[#151515] p-3 rounded-md overflow-auto max-h-48 text-sm whitespace-pre-wrap text-bolt-elements-textPrimary border border-transparent dark:border-[#1A1A1A]">
                {updateProgress.details.changelog}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-bolt-elements-textSecondary">
          <p>After completing these steps, restart your application to apply the updates.</p>
          <p className="mt-2">
            <span className="font-medium text-bolt-elements-textPrimary">Note:</span> If the upstream remote is already
            configured, you can skip step 2.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default UpdateTab;
