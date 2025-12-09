import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { amplifyConnection, updateAmplifyConnection, validateAmplifyCredentials } from '~/lib/stores/amplify';
import { Button } from '~/components/ui/Button';

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

export default function AmplifyTab() {
  const connection = useStore(amplifyConnection);
  const [accessKeyIdInput, setAccessKeyIdInput] = useState('');
  const [secretAccessKeyInput, setSecretAccessKeyInput] = useState('');
  const [regionInput, setRegionInput] = useState('us-east-1');
  const [appIdInput, setAppIdInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!accessKeyIdInput || !secretAccessKeyInput) {
      toast.error('Please enter both Access Key ID and Secret Access Key');
      return;
    }

    setIsConnecting(true);

    try {
      // Validate credentials
      const validation = await validateAmplifyCredentials(accessKeyIdInput, secretAccessKeyInput, regionInput);

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid credentials');
      }

      updateAmplifyConnection({
        user: {
          id: accessKeyIdInput.substring(0, 8),
          name: 'AWS User',
        },
        token: accessKeyIdInput,
        accessKeyId: accessKeyIdInput,
        secretAccessKey: secretAccessKeyInput,
        region: regionInput,
        appId: appIdInput || undefined,
      });

      toast.success('Connected to AWS Amplify successfully');
    } catch (error) {
      console.error('Error connecting to Amplify:', error);
      toast.error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
      setAccessKeyIdInput('');
      setSecretAccessKeyInput('');
      setAppIdInput('');
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('amplify_connection');
    updateAmplifyConnection({
      user: undefined,
      token: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
    });
    toast.success('Disconnected from AWS Amplify');
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
          <div className="i-ph:cloud-arrow-up w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">AWS Amplify Integration</h2>
        </div>
      </motion.div>

      <p className="text-sm text-bolt-elements-textSecondary">
        Connect your AWS account to deploy websites directly to AWS Amplify
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
                  <span className="font-medium">Tip:</span> Create an IAM user with Amplify permissions for best security
                </p>
              </div>

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">Access Key ID</label>
                <input
                  type="text"
                  value={accessKeyIdInput}
                  onChange={(e) => setAccessKeyIdInput(e.target.value)}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
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
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">Secret Access Key</label>
                <input
                  type="password"
                  value={secretAccessKeyInput}
                  onChange={(e) => setSecretAccessKeyInput(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
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
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">Region</label>
                <select
                  value={regionInput}
                  onChange={(e) => setRegionInput(e.target.value)}
                  className={classNames(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                    'border border-[#E5E5E5] dark:border-[#333333]',
                    'text-bolt-elements-textPrimary',
                    'focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive',
                  )}
                >
                  {AWS_REGIONS.map((region) => (
                    <option key={region.value} value={region.value}>
                      {region.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">
                  App ID <span className="text-xs">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={appIdInput}
                  onChange={(e) => setAppIdInput(e.target.value)}
                  placeholder="d123example"
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
                    href="https://console.aws.amazon.com/amplify"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                  >
                    Open AWS Amplify Console
                    <div className="i-ph:arrow-square-out w-4 h-4" />
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !accessKeyIdInput || !secretAccessKeyInput}
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
                  Connected to AWS Amplify
                </span>
              </div>

              {connection.user && (
                <div className="mt-4 p-4 bg-bolt-elements-background-depth-1 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="i-ph:user w-4 h-4 text-bolt-elements-item-contentAccent" />
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">Connection Info</span>
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary">
                    <p>Region: {connection.region}</p>
                    {connection.appId && <p className="mt-1">App ID: {connection.appId}</p>}
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

