import React from 'react';
import { AppCard } from './AppCard';
import { AppFeatureStatus, type AppSummary } from '~/lib/persistence/messageAppSummary';
import { formatPascalCaseName } from '~/utils/names';

interface MockupCardProps {
  mockupStatus: AppFeatureStatus;
  appSummary: AppSummary;
  onViewDetails: () => void;
}

export const MockupCard: React.FC<MockupCardProps> = ({ mockupStatus, appSummary, onViewDetails }) => {
  const pages = appSummary.pages || [];

  const getStatusInfo = () => {
    switch (mockupStatus) {
      case AppFeatureStatus.NotStarted:
        return {
          status: 'pending' as const,
          progressText: 'Not Started',
        };
      case AppFeatureStatus.ImplementationInProgress:
        return {
          status: 'in-progress' as const,
          progressText: 'Building Mockup...',
        };
      case AppFeatureStatus.Implemented:
      case AppFeatureStatus.Validated:
      case AppFeatureStatus.ValidationInProgress:
      case AppFeatureStatus.ValidationFailed:
        return {
          status: 'completed' as const,
          progressText: 'Mockup Complete',
        };
      default:
        return {
          status: 'pending' as const,
          progressText: 'Pending',
        };
    }
  };

  const getDescription = () => {
    const baseDescription = 'Builds a mockup of the app with a complete UI but no functionality.';

    if (pages.length === 0) {
      return baseDescription;
    }

    const pageNames = pages
      .slice(0, 2)
      .map((page) => formatPascalCaseName(page.name || ''))
      .join(', ');
    const remaining = pages.length - 2;

    if (remaining > 0) {
      return `${baseDescription} Includes ${pageNames} and ${remaining} more page${remaining === 1 ? '' : 's'}.`;
    }

    return `${baseDescription} Includes ${pageNames}.`;
  };

  const getPagesList = () => {
    if (pages.length === 0) {
      return null;
    }

    const displayPages = pages.slice(0, 3);
    const hasMore = pages.length > 3;

    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide">
          Page Layouts ({pages.length})
        </div>
        {displayPages.map((page, index) => (
          <div key={index} className="flex items-center gap-2 py-1">
            <div className="i-ph:layout text-bolt-elements-textSecondary text-sm flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                {formatPascalCaseName(page.name || `Page ${index + 1}`)}
              </div>
              {page.components && page.components.length > 0 && (
                <div className="text-xs text-bolt-elements-textSecondary">
                  {page.components.length} component{page.components.length === 1 ? '' : 's'}
                </div>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <div className="flex items-center gap-2 py-1 text-xs text-bolt-elements-textSecondary">
            <div className="i-ph:dots-three text-sm flex-shrink-0" />
            <span>
              and {pages.length - 3} more page{pages.length - 3 === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>
    );
  };

  const statusInfo = getStatusInfo();

  return (
    <AppCard
      title="Building Mockup"
      description={getDescription()}
      icon={<div className="i-ph:hammer text-white text-lg" />}
      iconColor="indigo"
      status={statusInfo.status}
      progressText={statusInfo.progressText}
      onClick={onViewDetails}
    >
      <div className="space-y-3">{getPagesList()}</div>
    </AppCard>
  );
};
