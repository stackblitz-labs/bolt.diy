import React from 'react';
import { classNames } from '~/utils/classNames';
import { Button } from './Button';
import { motion } from 'framer-motion';

// Variant-specific styles
const VARIANT_STYLES = {
  default: {
    container: 'py-8 p-6',
    icon: {
      container: 'w-12 h-12 mb-3',
      size: 'w-6 h-6',
    },
    title: 'text-base',
    description: 'text-sm mt-1',
    actions: 'mt-4',
    buttonSize: 'default' as const,
  },
  compact: {
    container: 'py-4 p-4',
    icon: {
      container: 'w-10 h-10 mb-2',
      size: 'w-5 h-5',
    },
    title: 'text-sm',
    description: 'text-xs mt-0.5',
    actions: 'mt-3',
    buttonSize: 'sm' as const,
  },
};

interface EmptyStateProps {
  /** Icon class name */
  icon?: string;

  /** Title text */
  title: string;

  /** Optional description text */
  description?: string;

  /** Primary action button label */
  actionLabel?: string;

  /** Primary action button callback */
  onAction?: () => void;

  /** Secondary action button label */
  secondaryActionLabel?: string;

  /** Secondary action button callback */
  onSecondaryAction?: () => void;

  /** Additional class name */
  className?: string;

  /** Component size variant */
  variant?: 'default' | 'compact';
}

/**
 * EmptyState component
 *
 * A component for displaying empty states with optional actions.
 */
export function EmptyState({
  icon = 'i-ph:folder-simple-dashed',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  variant = 'default',
}: EmptyStateProps) {
  // Get styles based on variant
  const styles = VARIANT_STYLES[variant];

  // Animation variants for buttons
  const buttonAnimation = {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
  };

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center',
        'text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark',
        'bg-bolt-elements-background-depth-2 dark:bg-bolt-elements-background-depth-3 rounded-lg',
        styles.container,
        className,
      )}
    >
      {/* Icon */}
      <div
        className={classNames(
          'rounded-full bg-bolt-elements-background-depth-3 dark:bg-bolt-elements-background-depth-4 flex items-center justify-center',
          styles.icon.container,
        )}
      >
        <span
          className={classNames(
            icon,
            styles.icon.size,
            'text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark',
          )}
        />
      </div>

      {/* Title */}
      <p className={classNames('font-medium', styles.title)}>{title}</p>

      {/* Description */}
      {description && (
        <p
          className={classNames(
            'text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark text-center max-w-xs',
            styles.description,
          )}
        >
          {description}
        </p>
      )}

      {/* Action buttons */}
      {(actionLabel || secondaryActionLabel) && (
        <div className={classNames('flex items-center gap-2', styles.actions)}>
          {actionLabel && onAction && (
            <motion.div {...buttonAnimation}>
              <Button
                onClick={onAction}
                variant="default"
                size={styles.buttonSize}
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                {actionLabel}
              </Button>
            </motion.div>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <motion.div {...buttonAnimation}>
              <Button onClick={onSecondaryAction} variant="outline" size={styles.buttonSize}>
                {secondaryActionLabel}
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
