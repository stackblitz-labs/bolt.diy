/**
 * Accessible Toast Component
 *
 * Implements FR-011 accessibility requirements for PCC notifications:
 * - Minimum 6s duration for destructive toasts
 * - ARIA role (status or alert)
 * - Escape key dismissal
 * - Keyboard navigation for CTAs
 * - Screen reader announcements
 *
 * Based on specs/001-places-crawler/tasks.md Task T015
 *
 * @module AccessibleToast
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { PCCToast } from '~/lib/services/crawlerAgent.schema';

interface AccessibleToastProps {
  toast: PCCToast;
  onDismiss: () => void;
  onCtaClick?: (ctaId: string) => void;
  className?: string;
  isTopToast?: boolean;
}

/**
 * Toast icon based on type
 */
function ToastIcon({ type }: { type: PCCToast['type'] }) {
  const iconClass = 'w-5 h-5';

  switch (type) {
    case 'info':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );

    case 'warning':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );

    case 'error':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );

    case 'success':
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}

/**
 * Get toast color classes based on type
 */
function getToastColorClasses(type: PCCToast['type']): string {
  const classes = {
    info: 'bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-300',
    warning:
      'bg-yellow-50 border-yellow-400 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-600 dark:text-yellow-300',
    error: 'bg-red-50 border-red-500 text-red-800 dark:bg-red-900/20 dark:border-red-600 dark:text-red-300',
    success:
      'bg-green-50 border-green-400 text-green-800 dark:bg-green-900/20 dark:border-green-600 dark:text-green-300',
  };

  return classes[type];
}

/**
 * Accessible Toast Component
 *
 * FR-011 Requirements:
 * - ≥6s duration for destructive (error, warning) toasts
 * - role="alert" for errors, role="status" for info/success
 * - Escape key dismissal
 * - Keyboard accessible CTAs
 * - Auto-dismiss timer with progress indicator
 */
export function AccessibleToast({
  toast,
  onDismiss,
  onCtaClick,
  className = '',
  isTopToast = false,
}: AccessibleToastProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  // Auto-dismiss timer
  useEffect(() => {
    if (toast.dismissible) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, toast.duration);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }

    return undefined;
  }, [toast.duration, toast.dismissible, onDismiss]);

  // Keyboard handler for Escape key
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (typeof window !== 'undefined' && toast.dismissible && isTopToast) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDismiss();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      cleanup = () => window.removeEventListener('keydown', handleKeyDown);
    }

    return cleanup;
  }, [toast.dismissible, onDismiss, isTopToast]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (typeof window !== 'undefined' && toast.ctaLabel && isTopToast) {
      const focusTimer = window.setTimeout(() => {
        ctaRef.current?.focus();
      }, 0);

      cleanup = () => window.clearTimeout(focusTimer);
    }

    return cleanup;
  }, [toast.ctaLabel, isTopToast]);

  const handleCtaClick = useCallback(() => {
    if (toast.ctaId && onCtaClick) {
      onCtaClick(toast.ctaId);
    }
  }, [toast.ctaId, onCtaClick]);

  const colorClasses = getToastColorClasses(toast.type);

  return (
    <div
      className={`pcc-toast relative flex items-start gap-3 p-4 rounded-lg border-2 shadow-lg animate-slide-in ${colorClasses} ${className}`}
      role={toast.role}
      aria-live={toast.role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {/* Icon */}
      <div className="toast-icon flex-shrink-0 mt-0.5">
        <ToastIcon type={toast.type} />
      </div>

      {/* Content */}
      <div className="toast-content flex-1 min-w-0">
        <p className="toast-message text-sm leading-relaxed whitespace-pre-wrap">{toast.message}</p>

        {/* CTA Button */}
        {toast.ctaLabel && (
          <button
            ref={ctaRef}
            type="button"
            className="toast-cta mt-3 px-4 py-2 bg-current/10 hover:bg-current/20 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-bolt-elements-background-depth-1"
            onClick={handleCtaClick}
            aria-label={toast.ctaLabel}
          >
            {toast.ctaLabel}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {toast.dismissible && (
        <button
          type="button"
          className="toast-dismiss flex-shrink-0 p-1 rounded-md hover:bg-current/10 transition-colors focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-bolt-elements-background-depth-1"
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Progress bar for auto-dismiss */}
      {toast.dismissible && (
        <div
          className="absolute bottom-0 left-0 h-1 bg-current/30 rounded-b-lg animate-shrink"
          style={{
            animationDuration: `${toast.duration}ms`,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Toast Container Component
 *
 * Manages multiple toasts with proper stacking and positioning
 */
interface ToastContainerProps {
  toasts: PCCToast[];
  onDismiss: (id: string) => void;
  onCtaClick?: (ctaId: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  className?: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
  onCtaClick,
  position = 'top-right',
  className = '',
}: ToastContainerProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={`toast-container fixed ${positionClasses[position]} z-50 flex flex-col gap-3 max-w-md w-full px-4 ${className}`}
    >
      {toasts.map((toast, index) => (
        <AccessibleToast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onCtaClick={onCtaClick}
          isTopToast={index === toasts.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Custom hook for managing toasts
 */
export function useAccessibleToasts() {
  const [toasts, setToasts] = useState<PCCToast[]>([]);

  const showToast = useCallback((toast: PCCToast) => {
    setToasts((prev) => {
      const updated = [...prev, toast];
      return updated.slice(-5);
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, showToast, dismissToast, dismissAll };
}
