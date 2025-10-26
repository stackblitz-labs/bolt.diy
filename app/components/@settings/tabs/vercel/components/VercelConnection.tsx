import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import {
  vercelConnection,
  isConnecting,
  isFetchingStats,
  updateVercelConnection,
  fetchVercelStats,
  autoConnectVercel,
} from '~/lib/stores/vercel';

export default function VercelConnection() {
  console.log('VercelConnection component mounted');

  const connection = useStore(vercelConnection);
  const connecting = useStore(isConnecting);
  const fetchingStats = useStore(isFetchingStats);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const hasInitialized = useRef(false);

  console.log('VercelConnection initial state:', {
    connection: {
      user: connection.user,
      token: connection.token ? '[TOKEN_EXISTS]' : '[NO_TOKEN]',
    },
    envToken: import.meta.env?.VITE_VERCEL_ACCESS_TOKEN ? '[ENV_TOKEN_EXISTS]' : '[NO_ENV_TOKEN]',
  });

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitialized.current) {
      console.log('Vercel: Already initialized, skipping');
      return;
    }

    const initializeConnection = async () => {
      console.log('Vercel initializeConnection:', {
        user: connection.user,
        token: connection.token ? '[TOKEN_EXISTS]' : '[NO_TOKEN]',
        envToken: import.meta.env?.VITE_VERCEL_ACCESS_TOKEN ? '[ENV_TOKEN_EXISTS]' : '[NO_ENV_TOKEN]',
      });

      hasInitialized.current = true;

      // Auto-connect using environment variable if no existing connection but token exists
      if (!connection.user && connection.token && import.meta.env?.VITE_VERCEL_ACCESS_TOKEN) {
        console.log('Vercel: Attempting auto-connection');

        const result = await autoConnectVercel();

        if (result.success) {
          toast.success('Connected to Vercel automatically');
        } else {
          console.error('Vercel auto-connection failed:', result.error);
        }
      } else if (connection.user && connection.token) {
        // Fetch stats for existing connection
        console.log('Vercel: Fetching stats for existing connection');
        await fetchVercelStats(connection.token);
      } else {
        console.log('Vercel: No auto-connection conditions met');
      }
    };

    initializeConnection();
  }, []); // Empty dependency array to run only once

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    isConnecting.set(true);

    try {
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${connection.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token or unauthorized');
      }

      const userData = (await response.json()) as any;
      updateVercelConnection({
        user: userData.user || userData, // Handle both possible structures
        token: connection.token,
      });

      await fetchVercelStats(connection.token);
      toast.success('Successfully connected to Vercel');
    } catch (error) {
      console.error('Auth error:', error);
      logStore.logError('Failed to authenticate with Vercel', { error });
      toast.error('Failed to connect to Vercel');
      updateVercelConnection({ user: null, token: '' });
    } finally {
      isConnecting.set(false);
    }
  };

  const handleDisconnect = () => {
    updateVercelConnection({ user: null, token: '' });
    toast.success('Disconnected from Vercel');
  };

  console.log('connection', connection);

  return (
    <motion.div
      className="bg-[#FFFFFF] dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              className="w-5 h-5 dark:invert"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src={`https://cdn.simpleicons.org/vercel/black`}
            />
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Vercel Connection</h3>
          </div>
        </div>

        {!connection.user ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">Personal Access Token</label>
              <input
                type="password"
                value={connection.token}
                onChange={(e) => updateVercelConnection({ ...connection, token: e.target.value })}
                disabled={connecting}
                placeholder="Enter your Vercel personal access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  'disabled:opacity-50',
                )}
              />
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
                <div className="mt-2 text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 p-2 rounded">
                  <p className="flex items-center gap-1">
                    <span className="i-ph:lightbulb w-3.5 h-3.5 text-bolt-elements-icon-success" />
                    <span className="font-medium">Tip:</span> You can also set{' '}
                    <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 rounded text-xs">
                      VITE_VERCEL_ACCESS_TOKEN
                    </code>{' '}
                    in your .env.local for automatic connection.
                  </p>
                </div>
                {/* Debug info - remove this later */}
                <div className="mt-2 text-xs text-gray-500">
                  <p>Debug: Token present: {connection.token ? '✅' : '❌'}</p>
                  <p>Debug: User present: {connection.user ? '✅' : '❌'}</p>
                  <p>Debug: Env token: {import.meta.env?.VITE_VERCEL_ACCESS_TOKEN ? '✅' : '❌'}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleConnect}
                disabled={connecting || !connection.token}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                  'bg-[#303030] text-white',
                  'hover:bg-[#5E41D0] hover:text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200',
                  'transform active:scale-95',
                )}
              >
                {connecting ? (
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

              {/* Debug button - remove this later */}
              <button
                onClick={async () => {
                  console.log('Manual auto-connect test');

                  const result = await autoConnectVercel();

                  if (result.success) {
                    toast.success('Manual auto-connect successful');
                  } else {
                    toast.error(`Manual auto-connect failed: ${result.error}`);
                  }
                }}
                className="px-3 py-2 rounded-lg text-xs bg-blue-500 text-white hover:bg-blue-600"
              >
                Test Auto-Connect
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                  Connected to Vercel
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
              {/* Debug output */}
              <pre className="hidden">{JSON.stringify(connection.user, null, 2)}</pre>

              <img
                src={`https://vercel.com/api/www/avatar?u=${connection.user?.username || connection.user?.user?.username}`}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                alt="User Avatar"
                className="w-12 h-12 rounded-full border-2 border-bolt-elements-borderColorActive"
              />
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                  {connection.user?.username || connection.user?.user?.username || 'Vercel User'}
                </h4>
                <p className="text-sm text-bolt-elements-textSecondary">
                  {connection.user?.email || connection.user?.user?.email || 'No email available'}
                </p>
              </div>
            </div>

            {fetchingStats ? (
              <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                Fetching Vercel projects...
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="w-full bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2"
                >
                  <div className="i-ph:buildings w-4 h-4" />
                  Your Projects ({connection.stats?.totalProjects || 0})
                  <div
                    className={classNames(
                      'i-ph:caret-down w-4 h-4 ml-auto transition-transform',
                      isProjectsExpanded ? 'rotate-180' : '',
                    )}
                  />
                </button>
                {isProjectsExpanded && connection.stats?.projects?.length ? (
                  <div className="grid gap-3">
                    {connection.stats.projects.map((project) => (
                      <a
                        key={project.id}
                        href={`https://vercel.com/dashboard/${project.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                              <div className="i-ph:globe w-4 h-4 text-bolt-elements-borderColorActive" />
                              {project.name}
                            </h5>
                            <div className="flex items-center gap-2 mt-2 text-xs text-bolt-elements-textSecondary">
                              {project.targets?.production?.alias && project.targets.production.alias.length > 0 ? (
                                <>
                                  <a
                                    href={`https://${project.targets.production.alias.find((a: string) => a.endsWith('.vercel.app') && !a.includes('-projects.vercel.app')) || project.targets.production.alias[0]}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-bolt-elements-borderColorActive"
                                  >
                                    {project.targets.production.alias.find(
                                      (a: string) => a.endsWith('.vercel.app') && !a.includes('-projects.vercel.app'),
                                    ) || project.targets.production.alias[0]}
                                  </a>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <div className="i-ph:clock w-3 h-3" />
                                    {new Date(project.createdAt).toLocaleDateString()}
                                  </span>
                                </>
                              ) : project.latestDeployments && project.latestDeployments.length > 0 ? (
                                <>
                                  <a
                                    href={`https://${project.latestDeployments[0].url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-bolt-elements-borderColorActive"
                                  >
                                    {project.latestDeployments[0].url}
                                  </a>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <div className="i-ph:clock w-3 h-3" />
                                    {new Date(project.latestDeployments[0].created).toLocaleDateString()}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          {project.framework && (
                            <div className="text-xs text-bolt-elements-textSecondary px-2 py-1 rounded-md bg-[#F0F0F0] dark:bg-[#252525]">
                              <span className="flex items-center gap-1">
                                <div className="i-ph:code w-3 h-3" />
                                {project.framework}
                              </span>
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : isProjectsExpanded ? (
                  <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                    <div className="i-ph:info w-4 h-4" />
                    No projects found in your Vercel account
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
