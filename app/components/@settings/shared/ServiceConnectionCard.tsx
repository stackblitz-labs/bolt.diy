import { motion } from 'framer-motion';
import { useId, useState } from 'react';
import type { ConnectionTestResult } from './service-integration';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';

export interface ServiceConnectionCardProps {
  serviceName: string;
  serviceIcon: React.ReactNode;
  isConnected: boolean;
  isConnecting: boolean;
  tokenValue: string;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onTestConnection?: () => Promise<void>;
  connectionTest?: ConnectionTestResult | null;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
    username?: string;
  };
  tokenPlaceholder?: string;
  tokenInputType?: 'text' | 'password';
  description?: string;
  documentationUrl?: string;
}

export function ServiceConnectionCard({
  serviceName,
  serviceIcon,
  isConnected,
  isConnecting,
  tokenValue,
  onTokenChange,
  onConnect,
  onDisconnect,
  onTestConnection,
  connectionTest,
  user,
  tokenPlaceholder = 'Enter your access token',
  tokenInputType = 'password',
  description,
  documentationUrl,
}: ServiceConnectionCardProps) {
  const tokenInputId = useId();
  const [showToken, setShowToken] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-bolt-elements-borderColor rounded-lg p-6 bg-bolt-elements-background-depth-2"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-bolt-elements-background-depth-3 rounded-lg">{serviceIcon}</div>
          <div>
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
              {serviceName}
              {isConnected && (
                <Badge variant="success">
                  <span className="i-ph:check-circle mr-1" />
                  Connected
                </Badge>
              )}
            </h2>
            {description && <p className="text-sm text-bolt-elements-textSecondary mt-1">{description}</p>}
          </div>
        </div>
        {documentationUrl && (
          <a
            href={documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
          >
            <span className="i-ph:question text-xl" />
          </a>
        )}
      </div>

      {/* Connection Status */}
      {isConnected && user && (
        <div className="mb-6 p-4 bg-bolt-elements-background-depth-1 rounded-lg">
          <div className="flex items-center gap-3">
            {user.avatar && (
              <img src={user.avatar} alt={user.name || user.username} className="w-10 h-10 rounded-full" />
            )}
            <div className="flex-1">
              <p className="font-medium text-bolt-elements-textPrimary">
                {user.name || user.username || 'Connected User'}
              </p>
              {user.email && <p className="text-sm text-bolt-elements-textSecondary">{user.email}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Token Input */}
      {!isConnected && (
        <div className="mb-6">
          <label htmlFor={tokenInputId} className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
            Access Token
          </label>
          <div className="relative">
            <input
              id={tokenInputId}
              type={showToken ? 'text' : tokenInputType}
              value={tokenValue}
              onChange={(e) => onTokenChange(e.target.value)}
              placeholder={tokenPlaceholder}
              className="w-full px-4 py-2 pr-10 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary placeholder:text-bolt-elements-textSecondary focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive"
            />
            {tokenInputType === 'password' && (
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Hide access token' : 'Show access token'}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded bg-transparent text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive"
              >
                <span aria-hidden="true" className={classNames(showToken ? 'i-ph:eye-slash' : 'i-ph:eye', 'text-xl')} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connection Test Result */}
      {connectionTest && (
        <div
          className={classNames(
            'mb-6 p-4 rounded-lg flex items-start gap-3',
            connectionTest.status === 'success' && 'bg-green-500/10 border border-green-500/20',
            connectionTest.status === 'error' && 'bg-red-500/10 border border-red-500/20',
            connectionTest.status === 'testing' && 'bg-blue-500/10 border border-blue-500/20',
          )}
        >
          <span
            className={classNames(
              'text-xl mt-0.5',
              connectionTest.status === 'success' && 'i-ph:check-circle text-green-500',
              connectionTest.status === 'error' && 'i-ph:x-circle text-red-500',
              connectionTest.status === 'testing' && 'i-ph:spinner animate-spin text-blue-500',
            )}
          />
          <div className="flex-1">
            <p
              className={classNames(
                'text-sm font-medium',
                connectionTest.status === 'success' && 'text-green-800 dark:text-green-300',
                connectionTest.status === 'error' && 'text-red-800 dark:text-red-300',
                connectionTest.status === 'testing' && 'text-blue-800 dark:text-blue-300',
              )}
            >
              {connectionTest.message}
            </p>
            {connectionTest.timestamp && (
              <p className="text-xs text-bolt-elements-textSecondary mt-1">
                {new Date(connectionTest.timestamp).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!isConnected ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onConnect}
              disabled={!tokenValue.trim() || isConnecting}
              className="flex-1 border border-bolt-elements-borderColor focus-visible:ring-bolt-elements-borderColorActive disabled:bg-bolt-elements-background-depth-3 disabled:text-bolt-elements-textSecondary disabled:!opacity-100"
            >
              {isConnecting ? (
                <>
                  <span className="i-ph:spinner animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <span className="i-ph:plug mr-2" />
                  Connect
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {onTestConnection && (
              <Button
                variant="outline"
                onClick={onTestConnection}
                disabled={connectionTest?.status === 'testing'}
                className="flex-1"
              >
                {connectionTest?.status === 'testing' ? (
                  <>
                    <span className="i-ph:spinner animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <span className="i-ph:heartbeat mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            )}
            <Button variant="destructive" onClick={onDisconnect} className="flex-1">
              <span className="i-ph:x-circle mr-2" />
              Disconnect
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
