/**
 * EmptyProjectState Component
 *
 * Displays a friendly empty state when a project has no messages.
 * Encourages the user to start a conversation.
 *
 * From specs/001-load-project-messages/tasks.md (T020)
 */

import { classNames } from '~/utils/classNames';

interface EmptyProjectStateProps {
  description?: string; // Optional project description
  className?: string;
}

export function EmptyProjectState({ description, className }: EmptyProjectStateProps) {
  return (
    <div
      className={classNames('flex flex-col items-center justify-center gap-6 py-16 px-4 w-full h-full', className)}
      data-empty-state="true"
    >
      {/* Icon/Illustration */}
      <div className="w-20 h-20 rounded-full bg-bolt-elements-bordersmile-quaternary flex items-center justify-center">
        <svg
          className="w-10 h-10 text-bolt-elements-textTertiary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>

      {/* Text content */}
      <div className="flex flex-col items-center gap-2 text-center max-w-md">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary">No messages yet</h3>
        <p className="text-sm text-bolt-elements-textSecondary">
          {description
            ? `Start a conversation for "${description}"`
            : 'Start a conversation to begin building your project'}
        </p>
      </div>

      {/* Prompt hint */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-bolt-elements-textTertiary">Type a message below to get started</p>
        {/* Visual indicator pointing to input */}
        <div className="flex flex-col items-center gap-1 mt-2 animate-bounce">
          <svg
            className="w-5 h-5 text-bolt-elements-textQuaternary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
