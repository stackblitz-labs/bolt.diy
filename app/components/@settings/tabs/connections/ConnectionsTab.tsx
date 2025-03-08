import { motion } from 'framer-motion';
import { GithubConnection } from './GithubConnection';
import { NetlifyConnection } from './NetlifyConnection';
import { useState } from 'react';
import { classNames } from '~/utils/classNames';

export default function ConnectionsTab() {
  const [isEnvVarsExpanded, setIsEnvVarsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        className="flex items-center gap-2 mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="i-ph:plugs-connected w-5 h-5 text-purple-500" />
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Connection Settings</h2>
      </motion.div>
      <p className="text-sm text-bolt-elements-textSecondary mb-6">
        Manage your external service connections and integrations
      </p>

      {/* Environment Variables Info - Collapsible */}
      <motion.div
        className="bg-[#FFFFFF] dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-6">
          <button
            onClick={() => setIsEnvVarsExpanded(!isEnvVarsExpanded)}
            className="w-full bg-transparent flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="i-ph:info-duotone w-5 h-5 text-purple-500" />
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Environment Variables</h3>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="i-ph:question-circle w-4 h-4 text-bolt-elements-textSecondary"
                title="Configure connections using environment variables"
              />
              <div
                className={classNames(
                  'i-ph:caret-down w-4 h-4 text-bolt-elements-textSecondary transition-transform',
                  isEnvVarsExpanded ? 'rotate-180' : '',
                )}
              />
            </div>
          </button>

          {isEnvVarsExpanded && (
            <div className="mt-4">
              <p className="text-sm text-bolt-elements-textSecondary mb-2">
                You can configure connections using environment variables in your{' '}
                <code className="px-1 py-0.5 bg-[#EFEFEF] dark:bg-[#252525] rounded">.env.local</code> file:
              </p>
              <div className="bg-[#F8F8F8] dark:bg-[#1A1A1A] p-3 rounded-md text-xs font-mono overflow-x-auto">
                <div className="text-bolt-elements-textSecondary"># GitHub Authentication</div>
                <div className="text-bolt-elements-textPrimary">VITE_GITHUB_ACCESS_TOKEN=your_token_here</div>
                <div className="text-bolt-elements-textSecondary">
                  # Optional: Specify token type (defaults to 'classic' if not specified)
                </div>
                <div className="text-bolt-elements-textPrimary">VITE_GITHUB_TOKEN_TYPE=classic|fine-grained</div>
              </div>
              <div className="mt-3 text-xs text-bolt-elements-textSecondary space-y-1">
                <p>
                  <span className="font-medium">Token types:</span>
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>
                    <span className="font-medium">classic</span> - Personal Access Token with{' '}
                    <code className="px-1 py-0.5 bg-[#EFEFEF] dark:bg-[#252525] rounded">
                      repo, read:org, read:user
                    </code>{' '}
                    scopes
                  </li>
                  <li>
                    <span className="font-medium">fine-grained</span> - Fine-grained token with Repository and
                    Organization access
                  </li>
                </ul>
                <p className="mt-2">
                  When set, these variables will be used automatically without requiring manual connection.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4">
        <GithubConnection />
        <NetlifyConnection />
      </div>
    </div>
  );
}
