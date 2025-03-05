import { motion } from 'framer-motion';
import React, { Suspense } from 'react';

// Use React.lazy for dynamic imports
const GithubConnection = React.lazy(() => import('./GithubConnection'));
const NetlifyConnection = React.lazy(() => import('./NetlifyConnection'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="p-4 bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A]">
    <div className="flex items-center gap-2 text-bolt-elements-textSecondary">
      <div className="i-ph:spinner-gap w-5 h-5 animate-spin" />
      <span>Loading connection...</span>
    </div>
  </div>
);

export default function ConnectionsTab() {
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

      <div className="grid grid-cols-1 gap-4">
        <Suspense fallback={<LoadingFallback />}>
          <GithubConnection />
        </Suspense>
        <Suspense fallback={<LoadingFallback />}>
          <NetlifyConnection />
        </Suspense>
      </div>
    </div>
  );
}
