import React, { useEffect } from 'react';
import { classNames } from '~/utils/classNames';
import type { GitHubAuthState } from '~/components/@settings/tabs/connections/types/GitHub';
import Cookies from 'js-cookie';
import { getLocalStorage } from '~/lib/persistence';

const GITHUB_TOKEN_KEY = 'github_token';

interface ConnectionFormProps {
  authState: GitHubAuthState;
  setAuthState: React.Dispatch<React.SetStateAction<GitHubAuthState>>;
  onSave: (e: React.FormEvent) => void;
  onDisconnect: () => void;
}

export function ConnectionForm({ authState, setAuthState, onSave, onDisconnect }: ConnectionFormProps) {
  // Check for saved token on mount
  useEffect(() => {
    const savedToken = Cookies.get(GITHUB_TOKEN_KEY) || Cookies.get('githubToken') || getLocalStorage(GITHUB_TOKEN_KEY);

    if (savedToken && !authState.tokenInfo?.token) {
      setAuthState((prev: GitHubAuthState) => ({
        ...prev,
        tokenInfo: {
          token: savedToken,
          scope: [],
          avatar_url: '',
          name: null,
          created_at: new Date().toISOString(),
          followers: 0,
        },
      }));

      // Ensure the token is also saved with the correct key for API requests
      Cookies.set('githubToken', savedToken);
    }
  }, []);

  return (
    <div className="rounded-xl bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#1A1A1A]">
              <div className="i-ph:plug-fill text-bolt-elements-textTertiary" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Connection Settings</h3>
              <p className="text-sm text-bolt-elements-textSecondary">Configure your GitHub connection</p>
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-bolt-elements-textSecondary mb-2">
              GitHub Username
            </label>
            <input
              id="username"
              type="text"
              value={authState.username}
              onChange={(e) => setAuthState((prev: GitHubAuthState) => ({ ...prev, username: e.target.value }))}
              className={classNames(
                'w-full px-4 py-2.5 bg-[#F5F5F5] dark:bg-[#1A1A1A] border rounded-lg',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary text-base',
                'border-[#E5E5E5] dark:border-[#1A1A1A]',
                'focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
                'transition-all duration-200',
              )}
              placeholder="e.g., octocat"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="token" className="block text-sm font-medium text-bolt-elements-textSecondary">
                Personal Access Token
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user,read:org,workflow,delete_repo,write:packages,read:packages"
                target="_blank"
                rel="noopener noreferrer"
                className={classNames(
                  'inline-flex items-center gap-1.5 text-xs',
                  'text-purple-500 hover:text-purple-600 dark:text-purple-400 dark:hover:text-purple-300',
                  'transition-colors duration-200',
                )}
              >
                <span>Generate new token</span>
                <div className="i-ph:plus-circle" />
              </a>
            </div>
            <input
              id="token"
              type="password"
              value={authState.tokenInfo?.token || ''}
              onChange={(e) =>
                setAuthState((prev: GitHubAuthState) => ({
                  ...prev,
                  tokenInfo: {
                    token: e.target.value,
                    scope: [],
                    avatar_url: '',
                    name: null,
                    created_at: new Date().toISOString(),
                    followers: 0,
                  },
                  username: '',
                  isConnected: false,
                  isVerifying: false,
                  isLoadingRepos: false,
                }))
              }
              className={classNames(
                'w-full px-4 py-2.5 bg-[#F5F5F5] dark:bg-[#1A1A1A] border rounded-lg',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary text-base',
                'border-[#E5E5E5] dark:border-[#1A1A1A]',
                'focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500',
                'transition-all duration-200',
              )}
              placeholder="ghp_xxxxxxxxxxxx"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A]">
            <div className="flex items-center gap-4">
              {!authState.isConnected ? (
                <button
                  type="submit"
                  disabled={authState.isVerifying || !authState.username || !authState.tokenInfo?.token}
                  className={classNames(
                    'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    'bg-purple-500 hover:bg-purple-600',
                    'text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {authState.isVerifying ? (
                    <>
                      <div className="i-ph:spinner animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:plug-fill" />
                      <span>Connect</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={onDisconnect}
                    className={classNames(
                      'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      'bg-[#F5F5F5] hover:bg-red-500/10 hover:text-red-500',
                      'dark:bg-[#1A1A1A] dark:hover:bg-red-500/20 dark:hover:text-red-500',
                      'text-bolt-elements-textPrimary',
                    )}
                  >
                    <div className="i-ph:plug-fill" />
                    <span>Disconnect</span>
                  </button>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-green-600 dark:text-green-400 bg-green-500/5 rounded-lg border border-green-500/20">
                    <div className="i-ph:check-circle-fill" />
                    <span>Connected</span>
                  </span>
                </>
              )}
            </div>
            {authState.rateLimits && (
              <div className="flex items-center gap-2 text-sm text-bolt-elements-textTertiary">
                <div className="i-ph:clock-countdown opacity-60" />
                <span>Rate limit resets at {authState.rateLimits.reset.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
