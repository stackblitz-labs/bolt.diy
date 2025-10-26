import { useCallback } from 'react';
import { toast as toastify } from 'react-toastify';

// Configure standard toast settings
export const configuredToast = {
  success: (message: string, options = {}) => toastify.success(message, { autoClose: 3000, ...options }),
  error: (message: string, options = {}) => toastify.error(message, { autoClose: 3000, ...options }),
  info: (message: string, options = {}) => toastify.info(message, { autoClose: 3000, ...options }),
  warning: (message: string, options = {}) => toastify.warning(message, { autoClose: 3000, ...options }),
  loading: (message: string, options = {}) => toastify.loading(message, { autoClose: 3000, ...options }),
};

// Export the original toast for cases where specific configuration is needed
export { toastify as toast };

interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function useToast() {
  const toast = useCallback((message: string, options: ToastOptions = {}) => {
    const { type = 'info', duration = 3000 } = options;

    toastify[type](message, {
      position: 'bottom-right',
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: 'dark',
    });
  }, []);

  const success = useCallback(
    (message: string, options: Omit<ToastOptions, 'type'> = {}) => {
      toast(message, { ...options, type: 'success' });
    },
    [toast],
  );

  const error = useCallback(
    (message: string, options: Omit<ToastOptions, 'type'> = {}) => {
      toast(message, { ...options, type: 'error' });
    },
    [toast],
  );

  const info = useCallback(
    (message: string, options: Omit<ToastOptions, 'type'> = {}) => {
      toast(message, { ...options, type: 'info' });
    },
    [toast],
  );

  const warning = useCallback(
    (message: string, options: Omit<ToastOptions, 'type'> = {}) => {
      toast(message, { ...options, type: 'warning' });
    },
    [toast],
  );

  return { toast, success, error, info, warning };
}
