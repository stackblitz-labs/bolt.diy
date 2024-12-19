import { memo, useState } from 'react';
import WithTooltip from '~/components/ui/Tooltip';
import { ModelUsageCard } from '~/components/ui/ModelUsageCard';
import { useTokenUsage } from '~/lib/hooks/useTokenUsage';
import type { TokenUsageStatsProps } from '~/types/token-usage';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export const TokenUsageStats = memo(({ messages }: TokenUsageStatsProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const { modelUsages, totalUsage, promptPercentage, completionPercentage } = useTokenUsage(messages);

  if (totalUsage.totalTokens === 0) {
    return null;
  }

  const tooltipContent = (
    <div className="flex flex-col bg-white/95 dark:bg-black/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-200/20 dark:border-gray-700/20">
      <div className="p-4 border-b border-gray-200/20 dark:border-gray-700/20">
        <div className="text-base font-semibold">Models Used</div>
      </div>

      <div className="overflow-y-auto max-h-[400px] p-4 space-y-6">
        {Array.from(modelUsages.values()).map((usage) => (
          <div
            key={`${usage.provider}-${usage.model}`}
            className="flex flex-col gap-3 pb-6 border-b border-gray-200/10 dark:border-gray-700/10 last:border-0 last:pb-0"
          >
            <div>
              <div className="font-medium text-base">{usage.model}</div>
              <div className="text-sm text-bolt-elements-textSecondary">({usage.provider})</div>
            </div>
            <div className="text-sm text-bolt-elements-textSecondary">
              Used {usage.count} time{usage.count === 1 ? '' : 's'}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">
                {usage.totalTokens.toLocaleString()} tokens (
                {((usage.totalTokens / totalUsage.totalTokens) * 100).toFixed(1)}%)
              </div>
              <div className="text-sm text-bolt-elements-textSecondary space-y-1">
                <div>Input: {usage.promptTokens.toLocaleString()}</div>
                <div>Output: {usage.completionTokens.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200/20 dark:border-gray-700/20 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="text-base font-semibold mb-3">Total Usage</div>
        <div className="space-y-2">
          <div className="text-sm space-y-1">
            <div className="text-bolt-elements-textSecondary">
              Input: {totalUsage.promptTokens.toLocaleString()} tokens ({promptPercentage}%)
            </div>
            <div className="text-bolt-elements-textSecondary">
              Output: {totalUsage.completionTokens.toLocaleString()} tokens ({completionPercentage}%)
            </div>
          </div>
          <div className="text-sm font-medium pt-1">Total: {totalUsage.totalTokens.toLocaleString()} tokens</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 text-sm text-bolt-elements-textSecondary">
      <div className="flex flex-col gap-3 bg-bolt-elements-background-depth-1 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {modelUsages.size} model{modelUsages.size === 1 ? '' : 's'} used
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-bolt-elements-background-depth-2">
              {totalUsage.totalTokens.toLocaleString()} tokens
            </span>
          </div>
          <div className="flex items-center gap-2">
            <WithTooltip
              tooltip={tooltipContent}
              maxWidth={480}
              className="!p-0 !bg-transparent"
              position="right"
              sideOffset={10}
            >
              <div className="text-sm font-medium px-3 py-1.5 rounded-md bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors cursor-help flex items-center gap-2">
                <span>Details</span>
                <svg className="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </WithTooltip>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-bolt-elements-background-depth-2 rounded-md transition-colors"
              aria-label={isMinimized ? 'Expand token usage stats' : 'Minimize token usage stats'}
            >
              {isMinimized ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            <div className="grid gap-3">
              {Array.from(modelUsages.values()).map((usage) => (
                <ModelUsageCard
                  key={`${usage.provider}-${usage.model}`}
                  usage={usage}
                  totalTokens={totalUsage.totalTokens}
                />
              ))}
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-bolt-elements-background-depth-2">
              <div className="flex justify-between text-xs">
                <span>Total Token Distribution</span>
                <div className="flex gap-3">
                  <span>Input: {promptPercentage}%</span>
                  <span>Output: {completionPercentage}%</span>
                </div>
              </div>
              <WithTooltip tooltip="Input tokens (prompts) vs Output tokens (completions)">
                <div className="h-1.5 bg-bolt-elements-background-depth-2 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${promptPercentage}%`,
                      background: 'linear-gradient(90deg, #B90EE1 0%, #8A0BA6 100%)',
                    }}
                  />
                </div>
              </WithTooltip>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

TokenUsageStats.displayName = 'TokenUsageStats';
