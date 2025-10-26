import React, { forwardRef } from 'react';
import { classNames } from '~/utils/classNames';
import { Input } from './Input';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Function to call when the clear button is clicked */
  onClear?: () => void;

  /** Whether to show the clear button when there is input */
  showClearButton?: boolean;

  /** Additional class name for the search icon */
  iconClassName?: string;

  /** Additional class name for the container */
  containerClassName?: string;

  /** Whether the search is loading */
  loading?: boolean;
}

/**
 * SearchInput component
 *
 * A search input field with a search icon and optional clear button.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    { className, onClear, showClearButton = true, iconClassName, containerClassName, loading = false, ...props },
    ref,
  ) => {
    const hasValue = Boolean(props.value);

    return (
      <div className={classNames('relative flex items-center w-full', containerClassName)}>
        {/* Search icon or loading spinner */}
        <div
          className={classNames(
            'absolute left-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary',
            iconClassName,
          )}
        >
          {loading ? (
            <span className="i-ph:spinner-gap animate-spin w-4 h-4" />
          ) : (
            <span className="i-ph:magnifying-glass w-4 h-4" />
          )}
        </div>

        {/* Input field */}
        <Input
          ref={ref}
          className={classNames('pl-10', hasValue && showClearButton ? 'pr-10' : '', className)}
          {...props}
        />

        {/* Clear button */}
        <AnimatePresence>
          {hasValue && showClearButton && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              type="button"
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary p-1 rounded-full hover:bg-bolt-elements-background-depth-2"
              aria-label="Clear search"
            >
              <span className="i-ph:x w-3.5 h-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

SearchInput.displayName = 'SearchInput';
