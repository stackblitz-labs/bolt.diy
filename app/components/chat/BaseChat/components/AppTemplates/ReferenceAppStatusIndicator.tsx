import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ReferenceAppStage } from '~/lib/replay/ReferenceApps';
import { classNames } from '~/utils/classNames';
import WithTooltip from '~/components/ui/Tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';

interface ReferenceAppStatusIndicatorProps {
  stage: ReferenceAppStage;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const getStageConfig = (stage: ReferenceAppStage) => {
  const stageConfig = {
    not_tested: {
      label: 'Not Tested',
      textColor: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      showWarning: true,
      description: 'This app has not been tested yet. It may contain bugs or incomplete features.',
    },
    broken: {
      label: 'Broken',
      textColor: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800',
      showWarning: true,
      description: 'This app is currently broken and may not work as expected. Use with caution.',
    },
    alpha: {
      label: 'Alpha',
      textColor: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      showWarning: false,
      description: 'This app is in alpha stage. It has basic functionality but may have bugs and missing features.',
    },
    beta: {
      label: 'Beta',
      textColor: 'text-indigo-700 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      borderColor: 'border-indigo-200 dark:border-indigo-800',
      showWarning: false,
      description: 'This app is in beta stage. Features should work but need more testing and polish.',
    },
    release: {
      label: 'Release',
      textColor: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      showWarning: false,
      description: 'This app is in release stage. It has been tested and is ready for production use.',
    },
  };

  return stageConfig[stage] || stageConfig.not_tested;
};

const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  const sizeConfig = {
    sm: {
      container: 'px-2 py-1 text-xs',
      iconSize: 12,
      gap: 'gap-1',
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      iconSize: 14,
      gap: 'gap-1.5',
    },
    lg: {
      container: 'px-4 py-2 text-base',
      iconSize: 16,
      gap: 'gap-2',
    },
  };

  return sizeConfig[size];
};

export const ReferenceAppStatusIndicator: React.FC<ReferenceAppStatusIndicatorProps> = ({
  stage,
  className,
  size = 'md',
}) => {
  const stageConfig = getStageConfig(stage);
  const sizeClasses = getSizeClasses(size);

  const indicator = (
    <div
      className={classNames(
        'rounded-full border text-xs sm:text-sm font-medium flex items-center',
        stageConfig.bgColor,
        stageConfig.textColor,
        stageConfig.borderColor,
        sizeClasses.container,
        sizeClasses.gap,
        className,
      )}
    >
      {stageConfig.showWarning && (
        <AlertTriangle size={sizeClasses.iconSize} className="flex-shrink-0" strokeWidth={2} />
      )}
      <span>{stageConfig.label}</span>
    </div>
  );

  return (
    <TooltipProvider>
      <WithTooltip
        tooltip={
          <div className="max-w-xs">
            <div className="font-semibold mb-1">{stageConfig.label}</div>
            <div className="text-xs opacity-90">{stageConfig.description}</div>
          </div>
        }
        position="top"
        maxWidth={300}
      >
        {indicator}
      </WithTooltip>
    </TooltipProvider>
  );
};
