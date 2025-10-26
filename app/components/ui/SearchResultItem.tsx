import React from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Badge } from './Badge';

interface SearchResultItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  iconBackground?: string;
  iconColor?: string;
  tags?: string[];
  metadata?: Array<{
    icon?: string;
    label: string;
    value?: string | number;
  }>;
  actionLabel?: string;
  onAction?: () => void;
  onClick?: () => void;
  className?: string;
}

export function SearchResultItem({
  title,
  subtitle,
  description,
  icon,
  iconBackground = 'bg-bolt-elements-background-depth-1/80 dark:bg-bolt-elements-background-depth-4/80',
  iconColor = 'text-purple-500',
  tags,
  metadata,
  actionLabel,
  onAction,
  onClick,
  className,
}: SearchResultItemProps) {
  return (
    <motion.div
      className={classNames(
        'p-5 rounded-xl border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor-dark hover:border-purple-500/40 transition-all duration-300 shadow-sm hover:shadow-md bg-bolt-elements-background-depth-1/50 dark:bg-bolt-elements-background-depth-3/50',
        onClick ? 'cursor-pointer' : '',
        className,
      )}
      whileHover={{
        scale: 1.01,
        y: -1,
        transition: { type: 'spring', stiffness: 400, damping: 17 },
      }}
      whileTap={{ scale: 0.99 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-start gap-3">
          {icon && (
            <div
              className={classNames(
                'w-10 h-10 rounded-xl backdrop-blur-sm flex items-center justify-center shadow-sm',
                iconBackground,
              )}
            >
              <span className={classNames(icon, 'w-5 h-5', iconColor)} />
            </div>
          )}
          <div>
            <h3 className="font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark text-base">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark flex items-center gap-1">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actionLabel && onAction && (
          <motion.button
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            className="px-4 py-2 h-9 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all duration-200 flex items-center gap-2 min-w-[100px] justify-center text-sm shadow-sm hover:shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {actionLabel}
          </motion.button>
        )}
      </div>

      {description && (
        <div className="mb-4 bg-bolt-elements-background-depth-1/50 dark:bg-bolt-elements-background-depth-4/50 backdrop-blur-sm p-3 rounded-lg border border-bolt-elements-borderColor/30 dark:border-bolt-elements-borderColor-dark/30">
          <p className="text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark line-clamp-2">
            {description}
          </p>
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {tags.map((tag) => (
            <Badge key={tag} variant="subtle" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {metadata && metadata.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark">
          {metadata.map((item, index) => (
            <div key={index} className="flex items-center gap-1">
              {item.icon && <span className={classNames(item.icon, 'w-3.5 h-3.5')} />}
              <span>
                {item.label}
                {item.value !== undefined && ': '}
                {item.value !== undefined && (
                  <span className="text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark">
                    {item.value}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
