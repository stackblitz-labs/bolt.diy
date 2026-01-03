/**
 * ChatSyncStatusBanner Component
 *
 * Displays the current sync status for project chat messages.
 * Part of specs/001-project-chat-sync implementation (Phase 1 skeleton).
 */

import { memo } from 'react';
import type { ChatSyncState } from '~/lib/persistence/messageSyncTypes';

interface ChatSyncStatusBannerProps {
  /** Current sync state */
  state?: ChatSyncState;
  /** Number of messages pending sync */
  pendingCount?: number;
  /** Last error message */
  error?: string;
  /** Callback to retry sync */
  onRetry?: () => void;
  /** Whether retry is in progress */
  retrying?: boolean;
}

/**
 * Banner component showing chat synchronization status.
 * Displays above the chat interface when sync issues occur.
 *
 * @component
 * @example
 * ```tsx
 * <ChatSyncStatusBanner
 *   state="pending"
 *   pendingCount={3}
 *   onRetry={handleRetrySync}
 * />
 * ```
 */
export const ChatSyncStatusBanner = memo(({
  state = 'synced',
  pendingCount = 0,
  error,
  onRetry,
  retrying = false,
}: ChatSyncStatusBannerProps) => {
  // Don't show banner if everything is synced
  if (state === 'synced') {
    return null;
  }

  // Placeholder skeleton - full implementation in Phase 5
  const getBannerContent = () => {
    switch (state) {
      case 'syncing':
        return {
          icon: 'i-svg-spinners:90-ring-with-bg',
          text: 'Syncing messages...',
          variant: 'info' as const,
        };
      case 'pending':
        return {
          icon: 'i-ph:warning',
          text: `${pendingCount} message${pendingCount !== 1 ? 's' : ''} not yet synced`,
          variant: 'warning' as const,
        };
      case 'error':
        return {
          icon: 'i-ph:x-circle',
          text: error || 'Sync failed',
          variant: 'error' as const,
        };
      case 'signed-out':
        return {
          icon: 'i-ph:info',
          text: 'Working offline - messages will sync when you sign in',
          variant: 'info' as const,
        };
      default:
        return null;
    }
  };

  const content = getBannerContent();
  if (!content) {
    return null;
  }

  const variantStyles = {
    info: 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textPrimary',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
  };

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b ${variantStyles[content.variant]}`}>
      <div className="flex items-center gap-2">
        <span className={content.icon} />
        <span className="text-sm font-medium">{content.text}</span>
      </div>
      {(state === 'error' || state === 'pending') && onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="px-3 py-1 text-xs font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded hover:bg-bolt-elements-background-depth-4 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          {retrying ? 'Retrying...' : 'Retry sync'}
        </button>
      )}
    </div>
  );
});

ChatSyncStatusBanner.displayName = 'ChatSyncStatusBanner';
