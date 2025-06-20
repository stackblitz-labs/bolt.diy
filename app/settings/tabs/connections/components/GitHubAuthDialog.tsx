import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import type { GitHubUserResponse } from '~/shared/components/github/types/GitHub';

interface GitHubAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubAuthDialog({ isOpen, onClose }: GitHubAuthDialogProps) {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tokenType, setTokenType] = useState<'classic' | 'fine-grained'>('classic');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = (await response.json()) as GitHubUserResponse;

        // Save connection data
        const connectionData = {
          token,
          tokenType,
          user: {
            login: userData.login,
            avatar_url: userData.avatar_url,
            name: userData.name || userData.login,
          },
          connected_at: new Date().toISOString(),
        };

        localStorage.setItem('github_connection', JSON.stringify(connectionData));

        // Set cookies for API requests
        Cookies.set('githubToken', token);
        Cookies.set('githubUsername', userData.login);
        Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));

        toast.success(`Successfully connected as ${userData.login}`);
        setToken('');
        onClose();
      } else {
        if (response.status === 401) {
          toast.error('Invalid GitHub token. Please check and try again.');
        } else {
          toast.error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error connecting to GitHub:', error);
      toast.error('Failed to connect to GitHub. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          >
            <Dialog.Content className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-sm w-full mx-4 overflow-hidden">
              <div className="p-4 space-y-3">
                <h2 className="text-lg font-semibold text-[#111111] dark:text-white">Access Private Repositories</h2>

                <p className="text-sm text-[#666666] dark:text-[#999999]">
                  To access private repositories, you need to connect your GitHub account by providing a personal access
                  token.
                </p>

                <div className="bg-[#F9F9F9] dark:bg-[#252525] p-4 rounded-lg space-y-3">
                  <h3 className="text-base font-medium text-[#111111] dark:text-white">Connect with GitHub Token</h3>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label className="block text-sm text-[#666666] dark:text-[#999999] mb-1">
                        GitHub Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-white placeholder-[#999999] text-sm"
                      />
                      <div className="mt-1 text-xs text-[#666666] dark:text-[#999999]">
                        Get your token at{' '}
                        <a
                          href="https://github.com/settings/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-500 hover:underline"
                        >
                          github.com/settings/tokens
                        </a>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm text-[#666666] dark:text-[#999999]">Token Type</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={tokenType === 'classic'}
                            onChange={() => setTokenType('classic')}
                            className="w-3.5 h-3.5 accent-purple-500"
                          />
                          <span className="text-sm text-[#111111] dark:text-white">Classic</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            checked={tokenType === 'fine-grained'}
                            onChange={() => setTokenType('fine-grained')}
                            className="w-3.5 h-3.5 accent-purple-500"
                          />
                          <span className="text-sm text-[#111111] dark:text-white">Fine-grained</span>
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isSubmitting ? 'Connecting...' : 'Connect to GitHub'}
                    </button>
                  </form>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg space-y-1.5">
                  <h3 className="text-sm text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
                    <span className="i-ph:warning-circle w-4 h-4" />
                    Accessing Private Repositories
                  </h3>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Important things to know about accessing private repositories:
                  </p>
                  <ul className="list-disc pl-4 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                    <li>You must be granted access to the repository by its owner</li>
                    <li>Your GitHub token must have the 'repo' scope</li>
                    <li>For organization repositories, you may need additional permissions</li>
                    <li>No token can give you access to repositories you don't have permission for</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-[#E5E5E5] dark:border-[#333333] p-3 flex justify-end">
                <Dialog.Close asChild>
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 bg-transparent bg-[#F5F5F5] hover:bg-[#E5E5E5] dark:bg-[#252525] dark:hover:bg-[#333333] rounded-lg text-[#111111] dark:text-white transition-colors text-sm"
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </motion.div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
