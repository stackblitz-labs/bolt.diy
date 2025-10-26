import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

export interface ConnectionTestResult {
  status: 'success' | 'error' | 'testing';
  message: string;
  timestamp?: number;
}

interface ConnectionTestIndicatorProps {
  testResult: ConnectionTestResult | null;
  className?: string;
}

export function ConnectionTestIndicator({ testResult, className }: ConnectionTestIndicatorProps) {
  if (!testResult) {
    return null;
  }

  return (
    <motion.div
      className={classNames(
        'p-4 rounded-lg border',
        {
          'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700': testResult.status === 'success',
          'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700': testResult.status === 'error',
          'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700': testResult.status === 'testing',
        },
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2">
        {testResult.status === 'success' && (
          <div className="i-ph:check-circle w-5 h-5 text-green-600 dark:text-green-400" />
        )}
        {testResult.status === 'error' && (
          <div className="i-ph:warning-circle w-5 h-5 text-red-600 dark:text-red-400" />
        )}
        {testResult.status === 'testing' && (
          <div className="i-ph:spinner-gap w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
        )}
        <span
          className={classNames('text-sm font-medium', {
            'text-green-800 dark:text-green-200': testResult.status === 'success',
            'text-red-800 dark:text-red-200': testResult.status === 'error',
            'text-blue-800 dark:text-blue-200': testResult.status === 'testing',
          })}
        >
          {testResult.message}
        </span>
      </div>
      {testResult.timestamp && (
        <p className="text-xs text-gray-500 mt-1">{new Date(testResult.timestamp).toLocaleString()}</p>
      )}
    </motion.div>
  );
}
