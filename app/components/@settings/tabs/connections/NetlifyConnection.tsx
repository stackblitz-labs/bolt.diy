import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import {
  netlifyConnection,
  isConnecting,
  isFetchingStats,
  updateNetlifyConnection,
  fetchNetlifyStats,
} from '~/lib/stores/netlify';
import type { NetlifyUser } from '~/types/netlify';

export default function NetlifyConnection() {
  const connection = useStore(netlifyConnection);
  const connecting = useStore(isConnecting);
  const fetchingStats = useStore(isFetchingStats);
  const [isSitesExpanded, setIsSitesExpanded] = useState(false);

  useEffect(() => {
    const fetchSites = async () => {
      if (connection.user && connection.token) {
        await fetchNetlifyStats(connection.token);
      }
    };
    fetchSites();
  }, [connection.user, connection.token]);

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    isConnecting.set(true);

    try {
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${connection.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Invalid token or unauthorized');
      }

      const userData = (await response.json()) as NetlifyUser;
      updateNetlifyConnection({
        user: userData,
        token: connection.token,
      });

      await fetchNetlifyStats(connection.token);
      toast.success('Successfully connected to Netlify');
    } catch (error) {
      console.error('Auth error:', error);
      logStore.logError('Failed to authenticate with Netlify', { error });
      toast.error('Failed to connect to Netlify');
      updateNetlifyConnection({ user: null, token: '' });
    } finally {
      isConnecting.set(false);
    }
  };

  const handleDisconnect = () => {
    updateNetlifyConnection({ user: null, token: '' });
    toast.success('Disconnected from Netlify');
  };

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
              className="w-5 h-5"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src="https://cdn.simpleicons.org/netlify"
            />
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Netlify Connection</h3>
          </div>
        </div>

        {!connection.user ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">Personal Access Token</label>
              <input
                type="password"
                value={connection.token}
                onChange={(e) => updateNetlifyConnection({ ...connection, token: e.target.value })}
                disabled={connecting}
                placeholder="Enter your Netlify personal access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-[#00AD9F]',
                  'disabled:opacity-50',
                )}
              />
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href="https://app.netlify.com/user/applications#personal-access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00AD9F] hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting || !connection.token}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                'bg-[#00AD9F] text-white',
                'hover:bg-[#00968A]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
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
                  Connected to Netlify
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
              <img
                src={connection.user.avatar_url}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                alt={connection.user.full_name}
                className="w-12 h-12 rounded-full border-2 border-[#00AD9F]"
              />
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{connection.user.full_name}</h4>
                <p className="text-sm text-bolt-elements-textSecondary">{connection.user.email}</p>
              </div>
            </div>

            {fetchingStats ? (
              <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                Fetching Netlify sites...
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setIsSitesExpanded(!isSitesExpanded)}
                  className="w-full bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2"
                >
                  <div className="i-ph:buildings w-4 h-4" />
                  Your Sites ({connection.stats?.totalSites || 0})
                  <div
                    className={classNames(
                      'i-ph:caret-down w-4 h-4 ml-auto transition-transform',
                      isSitesExpanded ? 'rotate-180' : '',
                    )}
                  />
                </button>
                {isSitesExpanded && connection.stats?.sites?.length ? (
                  <div className="grid gap-3">
                    {connection.stats.sites.map((site) => (
                      <a
                        key={site.id}
                        href={site.admin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#00AD9F] dark:hover:border-[#00AD9F] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                              <div className="i-ph:globe w-4 h-4 text-[#00AD9F]" />
                              {site.name}
                            </h5>
                            <div className="flex items-center gap-2 mt-2 text-xs text-bolt-elements-textSecondary">
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-[#00AD9F]"
                              >
                                {site.url}
                              </a>
                              {site.published_deploy && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <div className="i-ph:clock w-3 h-3" />
                                    {new Date(site.published_deploy.published_at).toLocaleDateString()}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {site.build_settings?.provider && (
                            <div className="text-xs text-bolt-elements-textSecondary px-2 py-1 rounded-md bg-[#F0F0F0] dark:bg-[#252525]">
                              <span className="flex items-center gap-1">
                                <div className="i-ph:git-branch w-3 h-3" />
                                {site.build_settings.provider}
                              </span>
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : isSitesExpanded ? (
                  <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                    <div className="i-ph:info w-4 h-4" />
                    No sites found in your Netlify account
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
