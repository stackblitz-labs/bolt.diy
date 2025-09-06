import React from 'react';
import { classNames } from '~/utils/classNames';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';

interface SmartAIToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  provider?: ProviderInfo;
  model?: string;
  modelList: ModelInfo[];
}

export const SmartAiToggle: React.FC<SmartAIToggleProps> = ({ enabled, onToggle, provider, model, modelList }) => {
  // Check if current model supports SmartAI
  const currentModel = modelList.find((m) => m.name === model);
  const isSupported = currentModel?.supportsSmartAI && (provider?.name === 'Anthropic' || provider?.name === 'OpenAI');

  if (!isSupported) {
    return null;
  }

  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={classNames(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all',
        'border border-bolt-elements-borderColor',
        enabled
          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30'
          : 'bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3',
      )}
      title="Toggle SmartAI for detailed conversational feedback"
    >
      <span
        className={classNames('i-ph:sparkle text-sm', enabled ? 'text-blue-400' : 'text-bolt-elements-textSecondary')}
      />
      <span
        className={classNames('text-xs font-medium', enabled ? 'text-blue-400' : 'text-bolt-elements-textSecondary')}
      >
        SmartAI {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  );
};
