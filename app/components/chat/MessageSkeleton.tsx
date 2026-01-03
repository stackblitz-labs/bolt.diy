/**
 * MessageSkeleton Component
 *
 * Displays shimmering skeleton placeholders while messages are loading.
 * Matches the visual dimensions of actual user/assistant message bubbles.
 *
 * From specs/001-load-project-messages/tasks.md (T018)
 */

import { classNames } from '~/utils/classNames';

interface MessageSkeletonProps {
  count?: number; // Number of skeleton messages to display (default: 6)
}

export function MessageSkeleton({ count = 6 }: MessageSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 py-4 w-full" data-skeleton="messages">
      {Array.from({ length: count }).map((_, index) => {
        // Alternate between user and assistant message layout
        const isUserMessage = index % 2 === 0;

        return (
          <div
            key={index}
            className={classNames('flex gap-4 w-full', {
              'justify-end': isUserMessage,
              'justify-start': !isUserMessage,
            })}
          >
            {/* Avatar placeholder */}
            <div
              className={classNames('w-8 h-8 rounded-full flex-shrink-0 animate-pulse', {
                'bg-bolt-elements-bordersmile-order': !isUserMessage,
                'bg-bolt-elements-bordersmile-tertiary': isUserMessage,
                'order-2': isUserMessage,
                'order-1': !isUserMessage,
              })}
            />

            {/* Message bubble placeholder */}
            <div
              className={classNames(
                'flex flex-col gap-2 max-w-[85%] w-full animate-pulse',
                {
                  'items-end': isUserMessage,
                  'items-start': !isUserMessage,
                },
              )}
            >
              {/* Name placeholder (assistant only) */}
              {!isUserMessage && (
                <div className="h-4 w-24 bg-bolt-elements-bordersmile-tertiary rounded" />
              )}

              {/* Content bubble placeholder */}
              <div
                className={classNames(
                  'rounded-lg p-4 w-full',
                  {
                    'bg-bolt-elements-bordersmile-tertiary': isUserMessage,
                    'bg-bolt-elements-bordersmile-quaternary': !isUserMessage,
                  },
                )}
              >
                {/* Text line placeholders */}
                <div className="space-y-2">
                  <div className="h-3 bg-bolt-elements-bordersmile-deepseconary/50 rounded w-3/4" />
                  <div className="h-3 bg-bolt-elements-bordersmile-deepseconary/50 rounded w-full" />
                  {index % 3 === 0 && <div className="h-3 bg-bolt-elements-bordersmile-deepseconary/50 rounded w-1/2" />}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
