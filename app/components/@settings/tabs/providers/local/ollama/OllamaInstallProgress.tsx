import React from 'react';
import { motion } from 'framer-motion';
import { Progress } from '~/components/ui/Progress';
import type { InstallProgress } from '~/components/@settings/tabs/providers/local/common/types';

interface OllamaInstallProgressProps {
  progress: InstallProgress;
}

export default function OllamaInstallProgress({ progress }: OllamaInstallProgressProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="p-4 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Installing Model</h4>
          <div className="text-xs text-bolt-elements-textSecondary">{progress.percent.toFixed(0)}% Complete</div>
        </div>

        <Progress value={progress.percent} className="h-2 mb-3" />

        <div className="flex flex-wrap justify-between gap-2 text-xs text-bolt-elements-textSecondary">
          <div className="flex items-center gap-1">
            <div className="i-ph:spinner-gap-bold animate-spin w-3 h-3" />
            <span>{progress.status}</span>
          </div>
          <div className="flex gap-3">
            <div>
              {progress.completed} / {progress.total} ({progress.totalSize})
            </div>
            <div>{progress.speed}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
