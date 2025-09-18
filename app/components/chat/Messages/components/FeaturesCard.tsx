import React from 'react';
import { AppCard } from './AppCard';
import { AppFeatureStatus, type AppSummary } from '~/lib/persistence/messageAppSummary';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';

interface FeaturesCardProps {
  appSummary: AppSummary;
  onViewDetails: () => void;
}

export const FeaturesCard: React.FC<FeaturesCardProps> = ({ appSummary, onViewDetails }) => {
  const features = appSummary.features?.slice(1) || [];
  const listenResponses = useStore(chatStore.listenResponses);
  const hasPendingMessage = useStore(chatStore.hasPendingMessage);
  const completedFeatures = features?.filter(
    (feature) =>
      feature.status === AppFeatureStatus.Validated ||
      feature.status === AppFeatureStatus.Implemented ||
      feature.status === AppFeatureStatus.ValidationInProgress ||
      feature.status === AppFeatureStatus.ValidationFailed,
  ).length;
  const totalFeatures = features.length;
  const isFullyComplete = totalFeatures && totalFeatures > 0 && completedFeatures === totalFeatures;

  const getStatusCounts = () => {
    const counts = {
      completed: 0,
      inProgress: 0,
      failed: 0,
      pending: 0,
    };

    features.forEach((feature) => {
      switch (feature.status) {
        case AppFeatureStatus.Implemented:
        case AppFeatureStatus.ValidationInProgress:
        case AppFeatureStatus.Validated:
        case AppFeatureStatus.ValidationFailed:
          counts.completed++;
          break;
        case AppFeatureStatus.ImplementationInProgress:
          counts.inProgress++;
          break;
        default:
          counts.pending++;
          break;
      }
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  const getOverallStatus = () => {
    if (totalFeatures === 0) {
      return {
        status: 'pending' as const,
        progressText: 'No features planned',
      };
    }

    if (!listenResponses && !hasPendingMessage && !isFullyComplete) {
      return {
        status: 'pending' as const,
        progressText: `Build Paused. ${completedFeatures}/${totalFeatures} complete`,
      };
    }

    if (statusCounts.failed > 0) {
      return {
        status: 'failed' as const,
        progressText: `${statusCounts.completed}/${totalFeatures} complete, ${statusCounts.failed} failed`,
      };
    }

    if (statusCounts.completed === totalFeatures) {
      return {
        status: 'completed' as const,
        progressText: 'All features completed',
      };
    }

    if (statusCounts.inProgress > 0) {
      return {
        status: 'in-progress' as const,
        progressText: `${statusCounts.inProgress} in progress`,
      };
    }

    return {
      status: 'pending' as const,
      progressText: `${statusCounts.completed}/${totalFeatures} complete`,
    };
  };

  const overallStatus = getOverallStatus();

  const getDescription = () => {
    // Use project description from appSummary as primary description
    if (appSummary.description) {
      return appSummary.description;
    }

    if (totalFeatures === 0) {
      return 'No features have been planned for this application yet.';
    }

    const featureNames = features
      .slice(0, 3)
      .map((f) => f.name)
      .join(', ');
    const remaining = totalFeatures - 3;

    if (remaining > 0) {
      return `${featureNames} and ${remaining} more feature${remaining === 1 ? '' : 's'}`;
    }

    return featureNames;
  };

  const getFeatureStatusIcon = (status: AppFeatureStatus) => {
    switch (status) {
      case AppFeatureStatus.Validated:
      case AppFeatureStatus.Implemented:
      case AppFeatureStatus.ValidationInProgress:
        return <div className="i-ph:check-circle text-green-500 text-sm flex-shrink-0" />;
      case AppFeatureStatus.ImplementationInProgress:
        return <div className="i-ph:circle-notch animate-spin text-blue-500 text-sm flex-shrink-0" />;
      case AppFeatureStatus.ValidationFailed:
        return <div className="i-ph:warning-circle text-red-500 text-sm flex-shrink-0" />;
      default:
        return <div className="i-ph:circle text-bolt-elements-textSecondary text-sm flex-shrink-0" />;
    }
  };

  const getContent = () => {
    // If no features, don't show progress/stats content
    if (totalFeatures === 0) {
      return null;
    }

    const displayFeatures = features.slice(0, 5);
    const hasMore = totalFeatures > 5;

    return (
      <div className="space-y-3">
        {/* Overall Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-bolt-elements-textSecondary">
            <span>Progress</span>
            <span>
              {statusCounts.completed} / {totalFeatures} complete
            </span>
          </div>
          <div className="w-full h-1.5 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 rounded-full"
              style={{
                width: `${totalFeatures > 0 ? (statusCounts.completed / totalFeatures) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* Features List */}
        <div className="relative">
          <div className="space-y-1.5">
            {displayFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 py-1">
                {getFeatureStatusIcon(feature.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{feature.name}</div>
                  <div className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary">
                    {feature.componentNames && feature.componentNames.length > 0 && (
                      <span>{feature.componentNames.length} components</span>
                    )}
                    {feature.definedAPIs && feature.definedAPIs.length > 0 && (
                      <span>{feature.definedAPIs.length} APIs</span>
                    )}
                    {feature.tests && feature.tests.length > 0 && <span>{feature.tests.length} tests</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="relative mt-2">
              <div className="absolute inset-x-0 -top-3 h-6 bg-gradient-to-t from-bolt-elements-background-depth-1 via-bolt-elements-background-depth-1/80 to-transparent pointer-events-none" />
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-bolt-elements-textSecondary bg-bolt-elements-background-depth-1">
                <div className="i-ph:dots-three text-sm flex-shrink-0" />
                <span>View all {totalFeatures} features</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Show card if there are features OR if there's a project description
  if (totalFeatures === 0 && !appSummary.description) {
    return null;
  }

  return (
    <AppCard
      title="Features"
      description={getDescription()}
      icon={<div className="i-ph:puzzle-piece-duotone text-white text-lg" />}
      iconColor="green"
      status={overallStatus.status}
      progressText={overallStatus.progressText}
      onClick={onViewDetails}
    >
      {getContent()}
    </AppCard>
  );
};
