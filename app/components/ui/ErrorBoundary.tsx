import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  showDetails?: boolean;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * Generic Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * <ErrorBoundary context="My Feature">
 *   <MyComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context || 'Unknown';
    logger.error(`Error Boundary (${context}) caught an error:`, error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error boundary if resetKeys change
    if (this.props.resetKeys && this.state.hasError) {
      const keysChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );

      if (keysChanged) {
        this.handleReset();
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDetails = this.props.showDetails ?? (typeof process !== 'undefined' && process.env.NODE_ENV === 'development');
      const context = this.props.context || 'application';

      return (
        <div className={classNames(
          'flex flex-col items-center justify-center p-8 rounded-lg border',
          'border-red-500/20 bg-red-500/5 text-center'
        )}>
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>

          <h3 className="text-lg font-medium text-red-500 mb-2">
            Something went wrong
          </h3>

          <p className="text-sm text-red-400 mb-6 max-w-md">
            There was an error in the {context}. Please try again or reload the page.
          </p>

          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className={classNames(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                'bg-red-500/10 text-red-500',
                'hover:bg-red-500/20',
                'transition-colors duration-200'
              )}
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <button
              onClick={this.handleReload}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'bg-red-500 text-white',
                'hover:bg-red-600',
                'transition-colors duration-200'
              )}
            >
              Reload Page
            </button>
          </div>

          {showDetails && this.state.error && (
            <details className="mt-6 w-full max-w-2xl text-left">
              <summary className="cursor-pointer text-sm text-red-400 hover:text-red-300 mb-2">
                Error Details (Development Only)
              </summary>
              <div className="space-y-2">
                <div className="p-3 bg-red-500/10 rounded text-xs">
                  <div className="font-medium text-red-300 mb-1">Error Message:</div>
                  <div className="text-red-400">{this.state.error.message}</div>
                </div>
                {this.state.error.stack && (
                  <div className="p-3 bg-red-500/10 rounded text-xs">
                    <div className="font-medium text-red-300 mb-1">Stack Trace:</div>
                    <pre className="text-red-400 overflow-auto max-h-60 whitespace-pre-wrap">
                      {this.state.error.stack}
                    </pre>
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div className="p-3 bg-red-500/10 rounded text-xs">
                    <div className="font-medium text-red-300 mb-1">Component Stack:</div>
                    <pre className="text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

/**
 * Hook for handling async errors in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const handleError = React.useCallback((err: unknown, context?: string) => {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    logger.error(`Async Error ${context ? `(${context})` : ''}:`, errorObj);
    setError(errorObj);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { handleError, resetError };
}
