import React from 'react';
import { classNames } from '~/utils/classNames';

// Status types supported by the component
type StatusType = 'online' | 'offline' | 'away' | 'busy' | 'success' | 'warning' | 'error' | 'info' | 'loading';

// Size types for the indicator
type SizeType = 'sm' | 'md' | 'lg';

// Status color mapping
const STATUS_COLORS: Record<StatusType, string> = {
  online: 'bg-green-500',
  success: 'bg-green-500',
  offline: 'bg-red-500',
  error: 'bg-red-500',
  away: 'bg-yellow-500',
  warning: 'bg-yellow-500',
  busy: 'bg-red-500',
  info: 'bg-blue-500',
  loading: 'bg-purple-500',
};

// Size class mapping
const SIZE_CLASSES: Record<SizeType, string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

// Text size mapping based on indicator size
const TEXT_SIZE_CLASSES: Record<SizeType, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

interface StatusIndicatorProps {
  /** The status to display */
  status: StatusType;

  /** Size of the indicator */
  size?: SizeType;

  /** Whether to show a pulsing animation */
  pulse?: boolean;

  /** Optional label text */
  label?: string;

  /** Additional class name */
  className?: string;
}

/**
 * StatusIndicator component
 *
 * A component for displaying status indicators with optional labels and pulse animations.
 */
export function StatusIndicator({ status, size = 'md', pulse = false, label, className }: StatusIndicatorProps) {
  // Get the color class for the status
  const colorClass = STATUS_COLORS[status] || 'bg-gray-500';

  // Get the size class for the indicator
  const sizeClass = SIZE_CLASSES[size];

  // Get the text size class for the label
  const textSizeClass = TEXT_SIZE_CLASSES[size];

  return (
    <div className={classNames('flex items-center gap-2', className)}>
      {/* Status indicator dot */}
      <span className={classNames('rounded-full relative', colorClass, sizeClass)}>
        {/* Pulse animation */}
        {pulse && <span className={classNames('absolute inset-0 rounded-full animate-ping opacity-75', colorClass)} />}
      </span>

      {/* Optional label */}
      {label && (
        <span
          className={classNames(
            'text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark',
            textSizeClass,
          )}
        >
          {label}
        </span>
      )}
    </div>
  );
}
