import { useState, useEffect } from 'react';
import { database } from '~/lib/persistence/apps';
import { AppUpdateReasonKind, type AppSummary, type AppUpdateReason } from '~/lib/persistence/messageAppSummary';
import { assert } from '~/utils/nut';
import { getRepositoryURL } from '~/lib/replay/DevelopmentServer';

export function includeHistorySummary(summary: AppSummary): boolean {
  if (!summary.reason) {
    return false;
  }

  switch (summary.reason.kind) {
    case AppUpdateReasonKind.FeatureImplemented:
    case AppUpdateReasonKind.BuildInitialApp:
    case AppUpdateReasonKind.RevertApp:
    case AppUpdateReasonKind.CopyApp:
    case AppUpdateReasonKind.ManualUpdate:
      return true;
    default:
      return false;
  }
}

interface AppHistoryProps {
  appId: string;
}

const AppHistory = ({ appId }: AppHistoryProps) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AppSummary[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [appId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const history = await database.getAppHistory(appId);
      setHistory(history.filter(includeHistorySummary));
    } catch (err) {
      console.error('Failed to fetch app history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInSeconds = Math.floor(diffInMs / 1000);
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInSeconds < 60) {
        return 'Just now';
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}m ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours}h ago`;
      } else if (diffInDays < 7) {
        return `${diffInDays}d ago`;
      } else {
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (_) {
      return timeString;
    }
  };

  const getFormattedTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return timeString;
    }
  };

  const renderUpdateReason = (reason: AppUpdateReason | undefined, history: AppSummary[]) => {
    assert(reason, 'Reason is required');
    switch (reason.kind) {
      case AppUpdateReasonKind.FeatureImplemented:
        return { text: `Feature implemented: ${reason.featureName}`, icon: '⚡', type: 'feature' as const };
      case AppUpdateReasonKind.BuildInitialApp:
        return { text: `Initial version of the app completed`, icon: '✅', type: 'success' as const };
      case AppUpdateReasonKind.RevertApp: {
        const targetSummary = history.find((summary) => summary.iteration === reason.iteration);
        assert(targetSummary, 'Target summary not found');
        return { text: `Reverted to version: ${targetSummary.version}`, icon: '↶', type: 'revert' as const };
      }
      case AppUpdateReasonKind.CopyApp:
        return { text: `Copied app ${reason.appId}`, icon: '📋', type: 'copy' as const };
      case AppUpdateReasonKind.ManualUpdate:
        return { text: `The app was updated manually`, icon: '✏️', type: 'manual' as const };
      default:
        return { text: 'Unknown reason', icon: '❓', type: 'default' as const };
    }
  };

  const getReasonBadgeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800';
      case 'feature':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
      case 'revert':
        return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800';
      case 'copy':
        return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800';
    }
  };

  const handleOpenPreview = (summary: AppSummary) => {
    window.open(getRepositoryURL(summary.repositoryId), '_blank');
  };

  const handleRevertToVersion = async (summary: AppSummary) => {
    await database.revertApp(appId, summary.iteration);
    fetchHistory();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-6 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-lg">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-bolt-elements-borderColor border-t-blue-500 shadow-sm"></div>
            <div className="text-bolt-elements-textSecondary font-medium">Loading history...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-bolt-elements-textHeading">Version History</h2>
        <div className="text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 bg-opacity-50 px-3 py-1.5 rounded-lg border border-bolt-elements-borderColor border-opacity-50 shadow-sm">
          {history.length} {history.length === 1 ? 'version' : 'versions'}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-50">
          <div className="text-6xl mb-6 opacity-50">📝</div>
          <div className="text-bolt-elements-textSecondary mb-3 text-lg font-medium">No version history available</div>
          <div className="text-sm text-bolt-elements-textSecondary">
            Changes will appear here as you work on your app
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {history.reverse().map((summary, index) => {
            const reasonInfo = renderUpdateReason(summary.reason, history);
            const isLatest = index === 0;
            return (
              <div
                key={index}
                className={`group relative bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-xl p-6 transition-all duration-200 hover:shadow-xl hover:border-bolt-elements-borderColor border-opacity-70 hover:scale-[1.01] shadow-sm ${
                  isLatest ? 'ring-2 ring-green-500/20 border-green-500/40 shadow-md' : ''
                }`}
              >
                {isLatest && (
                  <div className="absolute -top-3 left-6 px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-semibold rounded-full shadow-lg border border-white/20">
                    Current Selection
                  </div>
                )}

                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center px-4 py-2 bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary text-sm font-mono font-semibold rounded-lg border border-bolt-elements-borderColor shadow-sm">
                        v{summary.version || 'N/A'}
                      </span>
                      <span
                        className="text-sm text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 bg-opacity-50 px-3 py-1.5 rounded-lg"
                        title={getFormattedTime(summary.time)}
                      >
                        {formatRelativeTime(summary.time)}
                      </span>
                    </div>

                    <div>
                      <span
                        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md ${getReasonBadgeStyles(reasonInfo.type)}`}
                      >
                        <span className="text-base">{reasonInfo.icon}</span>
                        {reasonInfo.text}
                      </span>
                    </div>

                    <div className="text-xs text-bolt-elements-textSecondary font-mono bg-bolt-elements-background-depth-2 bg-opacity-30 px-3 py-2 rounded-lg inline-block border border-bolt-elements-borderColor border-opacity-30">
                      {getFormattedTime(summary.time)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 min-w-0">
                    <button
                      onClick={() => handleOpenPreview(summary)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor rounded-xl transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-105 group"
                      title="Open preview in new tab"
                    >
                      <span className="text-sm transition-transform duration-200 group-hover:scale-110">🔗</span>
                      <span className="font-medium">Preview</span>
                    </button>
                    {!isLatest && (
                      <button
                        onClick={() => handleRevertToVersion(summary)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl transition-all duration-200 whitespace-nowrap shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
                        title="Revert to this version"
                      >
                        <span className="text-sm transition-transform duration-200 group-hover:scale-110">↶</span>
                        <span className="font-medium">Revert</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppHistory;
