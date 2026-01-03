/**
 * LoadingProgress Component
 *
 * Displays a progress bar and message count during message loading.
 * Shows "Loading X of Y messages" when total is known, "Loading messages..." otherwise.
 *
 * From specs/001-load-project-messages/tasks.md (T019)
 */

import { classNames } from '~/utils/classNames';

interface LoadingProgressProps {
  loaded: number; // Number of messages loaded so far
  total: number | null; // Total messages (null if unknown)
  isRateLimited?: boolean; // True if currently rate limited and retrying
  className?: string;
}

export function LoadingProgress({ loaded, total, isRateLimited = false, className }: LoadingProgressProps) {
  // Calculate percentage (handle edge cases)
  const percentage = total && total > 0 ? Math.min((loaded / total) * 100, 100) : 0;

  // Determine progress text
  const getProgressText = (): string => {
    if (isRateLimited) {
      return 'Loading paused, retrying...';
    }

    if (total === null) {
      return 'Loading messages...';
    }

    if (total === 0) {
      return 'Loading...';
    }

    return `Loading ${loaded} of ${total} messages...`;
  };

  // Don't render if complete (loaded equals total and total is not null)
  if (total !== null && loaded >= total && total > 0) {
    return null;
  }

  return (
    <div className={classNames('flex flex-col items-center gap-2 px-4 py-2 w-full', className)} data-loading-progress="true">
      {/* Progress text */}
      <div className="text-sm text-bolt-elements-textTertiary">
        {getProgressText()}
      </div>

      {/* Progress bar */}
      {total !== null && total > 0 && (
        <div className="w-full h-1.5 bg-bolt-elements-bordersmile-tertiary rounded-full overflow-hidden">
          <div
            className="h-full bg-bolt-elements-accent transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
            data-progress-bar="true"
          />
        </div>
      )}

      {/* Indeterminate indicator for unknown total */}
      {total === null && (
        <div className="w-full h-1.5 bg-bolt-elements-bordersmile-tertiary rounded-full overflow-hidden">
          <div className="h-full bg-bolt-elements-accent animate-pulse w-1/3" data-progress-indeterminate="true" />
        </div>
      )}

      {/* Rate limited indicator */}
      {isRateLimited && (
        <div className="text-xs text-bolt-elements-textQuaternary flex items-center gap-1.5">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Rate limited, waiting to retry...</span>
        </div>
      )}
    </div>
  );
}
