import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import type { RepositoryStats } from '~/shared/components/github/types/GitHub';
import { formatSize } from '~/shared/utils/formatSize';
import { RepositoryStats as RepoStats } from '~/shared/components/ui';

interface StatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: RepositoryStats;
  isLargeRepo?: boolean;
}

export function StatsDialog({ isOpen, onClose, onConfirm, stats, isLargeRepo }: StatsDialogProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]" />
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] md:w-[500px]"
          >
            <Dialog.Content className="bg-white dark:bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark shadow-xl">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-3 flex items-center justify-center text-purple-500">
                    <span className="i-ph:git-branch w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark">
                      Repository Overview
                    </h3>
                    <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                      Review repository details before importing
                    </p>
                  </div>
                </div>

                <div className="mt-4 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 p-4 rounded-lg">
                  <RepoStats stats={stats} />
                </div>

                {isLargeRepo && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg text-sm flex items-start gap-2">
                    <span className="i-ph:warning text-yellow-600 dark:text-yellow-500 w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="text-yellow-800 dark:text-yellow-500">
                      This repository is quite large ({formatSize(stats.totalSize)}). Importing it might take a while
                      and could impact performance.
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark p-4 flex justify-end gap-3 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-b-lg">
                <motion.button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-bolt-elements-background-depth-3 dark:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary dark:text-bolt-elements-textSecondary-dark dark:hover:text-bolt-elements-textPrimary-dark transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Import Repository
                </motion.button>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
