import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import type { ServiceError } from '~/lib/utils/serviceErrorHandler';

interface ErrorStateProps {
  error?: ServiceError | string;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  className?: string;
  showDetails?: boolean;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  onDismiss,
  retryLabel = 'Try again',
  className,
  showDetails = false,
}: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'An unknown error occurred';
  const isServiceError = typeof error === 'object' && error !== null;

  return (
    <motion.div
      className={classNames(
        'p-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <div className="i-ph:warning-circle w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">{title}</h3>
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>

          {showDetails && isServiceError && error.details && (
            <details className="mt-3">
              <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                Technical details
              </summary>
              <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-auto">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-2 mt-4">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900/30"
              >
                <div className="i-ph:arrows-clockwise w-4 h-4 mr-1" />
                {retryLabel}
              </Button>
            )}
            {onDismiss && (
              <Button
                onClick={onDismiss}
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-600 dark:hover:bg-red-900/30"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface ConnectionErrorProps {
  service: string;
  error: ServiceError | string;
  onRetryConnection: () => void;
  onClearError?: () => void;
}

export function ConnectionError({ service, error, onRetryConnection, onClearError }: ConnectionErrorProps) {
  return (
    <ErrorState
      error={error}
      title={`Failed to connect to ${service}`}
      onRetry={onRetryConnection}
      onDismiss={onClearError}
      retryLabel="Retry connection"
      showDetails={true}
    />
  );
}
