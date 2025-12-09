import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import {
  cloudflareConnection,
  updateCloudflareConnection,
  initializeCloudflareConnection,
  fetchCloudflareStats,
} from '~/lib/stores/cloudflare';

export default function CloudflareTab() {
  const connection = useStore(cloudflareConnection);
  const [tokenInput, setTokenInput] = useState('');
  const [accountIdInput, setAccountIdInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Initialize connection with environment token if available
    initializeCloudflareConnection();
  }, []);

  const handleConnect = async () => {
    if (!tokenInput || !accountIdInput) {
      toast.error('Please enter both API token and Account ID');
      return;
    }

    setIsConnecting(true);

    try {
      // Verify token by fetching account details
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountIdInput}`, {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      updateCloudflareConnection({
        user: {
          id: data.result.id,
          name: data.result.name,
        },
        token: tokenInput,
        accountId: accountIdInput,
      });

      toast.success('Connected to Cloudflare successfully');

      // Fetch stats
      await fetchCloudflareStats(tokenInput, accountIdInput);
    } catch (error) {
      console.error('Error connecting to Cloudflare:', error);
      toast.error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
      setTokenInput('');
      setAccountIdInput('');
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('cloudflare_connection');
    updateCloudflareConnection({ user: undefined, token: '', accountId: '' });
    toast.success('Disconnected from Cloudflare');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between gap-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <div className="i-ph:cloud w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Cloudflare Integration</h2>
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your Cloudflare account to deploy websites directly to Cloudflare Workers Static Assets
      </p>

      {/* Main Connection Component */}
      <motion.div
        className="bg-bolt-elements-background border border-bolt-elements-borderColor rounded-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-6">
          {!connection.user ? (
            <div className="space-y-4">
              <div className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 p-3 rounded-lg mb-4">
                <p className="flex items-center gap-1 mb-1">
                  <span className="i-ph:lightbulb w-3.5 h-3.5 text-bolt-elements-icon-success" />
                  <span className="font-medium">Tip:</span> You can also set{' '}
                  <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 rounded">
                    VITE_CLOUDFLARE_API_TOKEN
                  </code>{' '}
                  and{' '}
                  <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 rounded">
                    VITE_CLOUDFLARE_ACCOUNT_ID
                  </code>{' '}
                  environment variables to connect automatically.
                </p>
              </div>

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">API Token</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter your Cloudflare API token"
                  className={classNames(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                    'border border-[#E5E5E5] dark:border-[#333333]',
                    'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                    'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                    'disabled:opacity-50',
                  )}
                />
              </div>

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">Account ID</label>
                <input
                  type="text"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder="Enter your Cloudflare Account ID"
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
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                  >
                    Create API token
                    <div className="i-ph:arrow-square-out w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !tokenInput || !accountIdInput}
                  className={classNames(
                    'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                    'bg-[#303030] text-white',
                    'hover:bg-[#5E41D0] hover:text-white',
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
              </div>
            </div>
          ) : (
            <div className="space-y-4">
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
                  Connected to Cloudflare
                </span>
              </div>

              {connection.user && (
                <div className="mt-4 p-4 bg-bolt-elements-background-depth-1 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="i-ph:user w-4 h-4 text-bolt-elements-item-contentAccent" />
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">Account Info</span>
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary">
                    <p>Name: {connection.user.name}</p>
                    <p className="mt-1">Account ID: {connection.accountId}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
