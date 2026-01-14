import React, { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Button } from '~/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GitHubErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GitHub Error Boundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>

          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">GitHub Integration Error</h3>
            <p className="text-sm text-bolt-elements-textSecondary mb-4 max-w-md">
              Something went wrong while loading GitHub data. This could be due to network issues, API limits, or a
              temporary problem.
            </p>

            {this.state.error && (
              <details className="text-xs text-bolt-elements-textTertiary mb-4">
                <summary className="cursor-pointer hover:text-bolt-elements-textSecondary">Show error details</summary>
                <pre className="mt-2 p-2 bg-bolt-elements-background-depth-2 rounded text-left overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              Try Again
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundary
export function withGitHubErrorBoundary<P extends object>(component: React.ComponentType<P>) {
  return function WrappedComponent(props: P) {
    return <GitHubErrorBoundary>{React.createElement(component, props)}</GitHubErrorBoundary>;
  };
}

// Hook for handling async errors in GitHub operations
export function useGitHubErrorHandler() {
  const handleError = React.useCallback((error: unknown, context?: string) => {
    console.error(`GitHub Error ${context ? `(${context})` : ''}:`, error);

    /*
     * You could integrate with error tracking services here
     * For example: Sentry, LogRocket, etc.
     */

    return error instanceof Error ? error.message : 'An unknown error occurred';
  }, []);

  return { handleError };
}
