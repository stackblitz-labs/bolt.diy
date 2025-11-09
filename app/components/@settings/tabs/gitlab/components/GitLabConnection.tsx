import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { useGitLabConnection } from '~/lib/hooks';

interface ConnectionTestResult {
  status: 'success' | 'error' | 'testing';
  message: string;
  timestamp?: number;
}

interface GitLabConnectionProps {
  connectionTest: ConnectionTestResult | null;
  onTestConnection: () => void;
}

export default function GitLabConnection({ connectionTest, onTestConnection }: GitLabConnectionProps) {
  const { isConnected, isConnecting, connection, error, connect, disconnect } = useGitLabConnection();

  const [token, setToken] = useState('');
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com');

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();

    console.log('GitLab connect attempt:', {
      token: token ? `${token.substring(0, 10)}...` : 'empty',
      gitlabUrl,
      tokenLength: token.length,
    });

    if (!token.trim()) {
      console.log('Token is empty, not attempting connection');
      return;
    }

    try {
      console.log('Calling connect function...');
      await connect(token, gitlabUrl);
      console.log('Connect function completed successfully');
      setToken(''); // Clear token on successful connection
    } catch (error) {
      console.error('GitLab connect failed:', error);

      // Error handling is done in the hook
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Disconnected from GitLab');
  };

  return (
    <motion.div
      className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-orange-600">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path
                  fill="currentColor"
                  d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
                />
              </svg>
            </div>
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">GitLab Connection</h3>
          </div>
        </div>

        {!isConnected && (
          <div className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 p-3 rounded-lg mb-4">
            <p className="flex items-center gap-1 mb-1">
              <span className="i-ph:lightbulb w-3.5 h-3.5 text-bolt-elements-icon-success" />
              <span className="font-medium">Tip:</span> You can also set the{' '}
              <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 rounded">VITE_GITLAB_ACCESS_TOKEN</code>{' '}
              environment variable to connect automatically.
            </p>
            <p>
              For self-hosted GitLab instances, also set{' '}
              <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 rounded">
                VITE_GITLAB_URL=https://your-gitlab-instance.com
              </code>
            </p>
          </div>
        )}

        <form onSubmit={handleConnect}>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">GitLab URL</label>
              <input
                type="text"
                value={gitlabUrl}
                onChange={(e) => setGitlabUrl(e.target.value)}
                disabled={isConnecting || isConnected}
                placeholder="https://gitlab.com"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-1',
                  'border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
              />
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">Access Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={isConnecting || isConnected}
                placeholder="Enter your GitLab access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-1',
                  'border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
              />
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href={`${gitlabUrl}/-/user_settings/personal_access_tokens`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
                <span className="mx-2">•</span>
                <span>Required scopes: api, read_repository</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            {!isConnected ? (
              <>
                <button
                  type="submit"
                  disabled={isConnecting || !token.trim()}
                  className={classNames(
                    'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                    'bg-[#FC6D26] text-white',
                    'hover:bg-[#E24329] hover:text-white',
                    'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
                    'transform active:scale-95',
                  )}
                >
                  {isConnecting ? (
                    <>
                      <div className="i-ph:spinner-gap animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <div className="i-ph:plug-charging w-4 h-4" />
                      Connect
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    console.log('Manual test:', { token: token ? `${token.substring(0, 10)}...` : 'empty', gitlabUrl })
                  }
                  className="px-4 py-2 rounded-lg text-sm bg-gray-500 text-white hover:bg-gray-600"
                >
                  Test Values
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleDisconnect}
                      className={classNames(
                        'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                        'bg-red-500 text-white',
                        'hover:bg-red-600',
                      )}
                    >
                      <div className="i-ph:plug w-4 h-4" />
                      Disconnect
                    </button>
                    <span className="text-sm text-bolt-elements-textSecondary flex items-center gap-1">
                      <div className="i-ph:check-circle w-4 h-4 text-green-500" />
                      Connected to GitLab
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `${connection?.gitlabUrl || 'https://gitlab.com'}/dashboard`,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                      className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      <div className="i-ph:layout w-4 h-4" />
                      Dashboard
                    </Button>
                    <Button
                      onClick={onTestConnection}
                      disabled={connectionTest?.status === 'testing'}
                      variant="outline"
                      className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      {connectionTest?.status === 'testing' ? (
                        <>
                          <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:plug-charging w-4 h-4" />
                          Test Connection
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  );
}
