import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import type { ModelInfo } from '~/components/@settings/tabs/providers/local/common/types';
import { cn } from '~/utils/classNames';

// Ollama Icon SVG component
function OllamaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor">
      <path d="M684.3 322.2H339.8c-9.5.1-17.7 6.8-19.6 16.1-8.2 41.4-12.4 83.5-12.4 125.7 0 42.2 4.2 84.3 12.4 125.7 1.9 9.3 10.1 16 19.6 16.1h344.5c9.5-.1 17.7-6.8 19.6-16.1 8.2-41.4 12.4-83.5 12.4-125.7 0-42.2-4.2-84.3-12.4-125.7-1.9-9.3-10.1-16-19.6-16.1zM512 640c-176.7 0-320-143.3-320-320S335.3 0 512 0s320 143.3 320 320-143.3 320-320 320z" />
    </svg>
  );
}

interface OllamaModelCardProps {
  model: ModelInfo;
  onInstall: () => void;
  onDelete: () => void;
  isInstalling: boolean;
}

export default function OllamaModelCard({ model, onInstall, onDelete, isInstalling }: OllamaModelCardProps) {
  return (
    <motion.div
      key={model.name}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'p-4 rounded-xl border',
        'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
        'transition-all duration-200',
        isInstalling
          ? 'border-purple-500/50 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]'
          : 'hover:border-bolt-elements-borderColor/80',
      )}
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-medium text-bolt-elements-textPrimary">{model.name}</h3>
            <p className="text-sm text-bolt-elements-textSecondary mt-1">{model.desc}</p>
          </div>
          {model.installed && (
            <div className="px-2 py-1 rounded-lg text-xs bg-green-500/10 text-green-500 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Installed
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-1 mb-3">
          {model.tags?.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-xs bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="text-sm text-bolt-elements-textTertiary">{model.size}</div>

          <div className="flex gap-2">
            {model.installed ? (
              <Button variant="destructive" size="sm" onClick={onDelete} disabled={isInstalling}>
                {isInstalling ? (
                  <>
                    <div className="i-ph:spinner-gap-bold animate-spin w-3 h-3 mr-1" />
                    Removing...
                  </>
                ) : (
                  'Remove'
                )}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={onInstall}
                disabled={isInstalling}
                className={isInstalling ? 'bg-purple-500' : ''}
              >
                {isInstalling ? (
                  <>
                    <div className="i-ph:spinner-gap-bold animate-spin w-3 h-3 mr-1" />
                    Installing...
                  </>
                ) : (
                  <>
                    <OllamaIcon className="w-3 h-3 mr-1" />
                    Install
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
