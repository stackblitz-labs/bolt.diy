import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

interface TokenTypeOption {
  value: string;
  label: string;
  description?: string;
}

interface ConnectionFormProps {
  isConnected: boolean;
  isConnecting: boolean;
  token: string;
  onTokenChange: (token: string) => void;
  onConnect: (e: React.FormEvent) => void;
  onDisconnect: () => void;
  error?: string;
  serviceName: string;
  tokenLabel?: string;
  tokenPlaceholder?: string;
  getTokenUrl: string;
  environmentVariable?: string;
  tokenTypes?: TokenTypeOption[];
  selectedTokenType?: string;
  onTokenTypeChange?: (type: string) => void;
  connectedMessage?: string;
  children?: React.ReactNode; // For additional form fields
}

export function ConnectionForm({
  isConnected,
  isConnecting,
  token,
  onTokenChange,
  onConnect,
  onDisconnect,
  error,
  serviceName,
  tokenLabel = 'Access Token',
  tokenPlaceholder,
  getTokenUrl,
  environmentVariable,
  tokenTypes,
  selectedTokenType,
  onTokenTypeChange,
  connectedMessage = `Connected to ${serviceName}`,
  children,
}: ConnectionFormProps) {
  return (
    <motion.div
      className="bg-bolt-elements-background dark:bg-bolt-elements-background border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor rounded-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="p-6 space-y-6">
        {!isConnected ? (
          <div className="space-y-4">
            {environmentVariable && (
              <div className="text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1 p-3 rounded-lg mb-4">
                <p className="flex items-center gap-1 mb-1">
                  <span className="i-ph:lightbulb w-3.5 h-3.5 text-bolt-elements-icon-success dark:text-bolt-elements-icon-success" />
                  <span className="font-medium">Tip:</span> You can also set the{' '}
                  <code className="px-1 py-0.5 bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-2 rounded">
                    {environmentVariable}
                  </code>{' '}
                  environment variable to connect automatically.
                </p>
              </div>
            )}

            <form onSubmit={onConnect} className="space-y-4">
              {tokenTypes && tokenTypes.length > 1 && onTokenTypeChange && (
                <div>
                  <label className="block text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mb-2">
                    Token Type
                  </label>
                  <select
                    value={selectedTokenType}
                    onChange={(e) => onTokenTypeChange(e.target.value)}
                    disabled={isConnecting}
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-1',
                      'border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary',
                      'focus:outline-none focus:ring-1 focus:ring-bolt-elements-item-contentAccent dark:focus:ring-bolt-elements-item-contentAccent',
                      'disabled:opacity-50',
                    )}
                  >
                    {tokenTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {selectedTokenType && tokenTypes.find((t) => t.value === selectedTokenType)?.description && (
                    <p className="mt-1 text-xs text-bolt-elements-textTertiary">
                      {tokenTypes.find((t) => t.value === selectedTokenType)?.description}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">{tokenLabel}</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => onTokenChange(e.target.value)}
                  disabled={isConnecting}
                  placeholder={tokenPlaceholder || `Enter your ${serviceName} access token`}
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
                    href={getTokenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-bolt-elements-borderColorActive hover:underline inline-flex items-center gap-1"
                  >
                    Get your token
                    <div className="i-ph:arrow-square-out w-4 h-4" />
                  </a>
                </div>
              </div>

              {children}

              {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isConnecting || !token.trim()}
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
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onDisconnect}
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
                {connectedMessage}
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
