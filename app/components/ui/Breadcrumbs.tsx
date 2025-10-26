import React from 'react';
import { classNames } from '~/utils/classNames';
import { motion } from 'framer-motion';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: string;
  maxItems?: number;
  renderItem?: (item: BreadcrumbItem, index: number, isLast: boolean) => React.ReactNode;
}

export function Breadcrumbs({
  items,
  className,
  separator = 'i-ph:caret-right',
  maxItems = 0,
  renderItem,
}: BreadcrumbsProps) {
  const displayItems =
    maxItems > 0 && items.length > maxItems
      ? [
          ...items.slice(0, 1),
          { label: '...', onClick: undefined, href: undefined },
          ...items.slice(-Math.max(1, maxItems - 2)),
        ]
      : items;

  const defaultRenderItem = (item: BreadcrumbItem, index: number, isLast: boolean) => {
    const content = (
      <div className="flex items-center gap-1.5">
        {item.icon && <span className={classNames(item.icon, 'w-3.5 h-3.5')} />}
        <span
          className={classNames(
            isLast
              ? 'font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary-dark'
              : 'text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary-dark hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary-dark',
            item.onClick || item.href ? 'cursor-pointer' : '',
          )}
        >
          {item.label}
        </span>
      </div>
    );

    if (item.href && !isLast) {
      return (
        <motion.a href={item.href} className="hover:underline" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          {content}
        </motion.a>
      );
    }

    if (item.onClick && !isLast) {
      return (
        <motion.button
          type="button"
          onClick={item.onClick}
          className="hover:underline"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {content}
        </motion.button>
      );
    }

    return content;
  };

  return (
    <nav className={classNames('flex items-center', className)} aria-label="Breadcrumbs">
      <ol className="flex items-center gap-1.5">
        {displayItems.map((item, index) => {
          const isLast = index === displayItems.length - 1;

          return (
            <li key={index} className="flex items-center">
              {renderItem ? renderItem(item, index, isLast) : defaultRenderItem(item, index, isLast)}
              {!isLast && (
                <span
                  className={classNames(
                    separator,
                    'w-3 h-3 mx-1 text-bolt-elements-textTertiary dark:text-bolt-elements-textTertiary-dark',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
