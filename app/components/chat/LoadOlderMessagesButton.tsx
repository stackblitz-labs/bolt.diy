/**
 * LoadOlderMessagesButton Component
 *
 * UI component for loading older messages on demand.
 * Part of specs/001-project-chat-sync implementation (Phase 1 skeleton).
 */

import { memo } from 'react';

interface LoadOlderMessagesButtonProps {
  /** Callback when user clicks to load older messages */
  onLoadOlder?: () => void;
  /** Whether the load operation is in progress */
  loading?: boolean;
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Error message to display if load failed */
  error?: string;
  /** Number of older messages available (optional, for display) */
  olderCount?: number;
}

/**
 * Button for loading older chat messages.
 * Displays above the message list when older messages are available.
 *
 * @component
 * @example
 * ```tsx
 * <LoadOlderMessagesButton
 *   onLoadOlder={handleLoadOlder}
 *   loading={isLoading}
 *   disabled={isStreaming}
 * />
 * ```
 */
export const LoadOlderMessagesButton = memo(({
  onLoadOlder,
  loading = false,
  disabled = false,
  error,
  olderCount,
}: LoadOlderMessagesButtonProps) => {
  return (
    <div className="flex justify-center py-4">
      <button
        onClick={onLoadOlder}
        disabled={disabled || loading}
        className="px-4 py-2 text-sm font-medium text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg hover:bg-bolt-elements-background-depth-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        type="button"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="i-svg-spinners:90-ring-with-bg" />
            Loading older messages...
          </span>
        ) : error ? (
          <span className="text-bolt-elements-textError">
            Failed to load. Click to retry.
          </span>
        ) : (
          <span>
            Load older messages
            {olderCount !== undefined && olderCount > 0 ? ` (${olderCount})` : ''}
          </span>
        )}
      </button>
    </div>
  );
});

LoadOlderMessagesButton.displayName = 'LoadOlderMessagesButton';
