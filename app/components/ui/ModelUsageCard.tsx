import { useState } from 'react';
import { MODEL_LIST } from '~/utils/constants';
import { PROVIDER_ICONS } from '~/utils/provider-icons';
import type { ModelUsage } from '~/types/token-usage';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ModelCardProps {
  usage: ModelUsage;
  totalTokens: number;
}

export function ModelUsageCard({ usage, totalTokens }: ModelCardProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-bolt-elements-background-depth-2">
      <div className="relative flex-shrink-0">
        <img
          src={PROVIDER_ICONS[usage.provider] || PROVIDER_ICONS.Default}
          alt={`${usage.provider} icon`}
          className="w-8 h-8 rounded-lg bg-bolt-elements-background-depth-1 p-1"
        />
        <span className="absolute -top-1 -right-1 bg-bolt-elements-background-depth-1 text-[10px] px-1.5 rounded-full ring-1 ring-bolt-elements-background-depth-2 font-medium">
          {usage.count}×
        </span>
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium truncate">
              {MODEL_LIST.find((m) => m.name === usage.model)?.label || usage.model}
            </span>
            <span className="text-xs opacity-75">{usage.provider}</span>
          </div>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-bolt-elements-background-depth-1 rounded-md transition-colors"
            aria-label={isMinimized ? 'Expand details' : 'Minimize details'}
          >
            {isMinimized ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
          </button>
        </div>

        {!isMinimized && (
          <>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-bolt-elements-background-depth-1 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${((usage.totalTokens / totalTokens) * 100).toFixed(1)}%`,
                    background: 'linear-gradient(90deg, #B90EE1 0%, #8A0BA6 100%)',
                  }}
                />{' '}
              </div>
              <span className="text-xs whitespace-nowrap">{((usage.totalTokens / totalTokens) * 100).toFixed(1)}%</span>
            </div>

            <div className="flex gap-4 mt-1 text-xs opacity-75">
              <span>Input: {usage.promptTokens.toLocaleString()}</span>
              <span>Output: {usage.completionTokens.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
