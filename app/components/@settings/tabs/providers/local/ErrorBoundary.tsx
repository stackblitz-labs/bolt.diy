import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { classNames } from '~/utils/classNames';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Local Providers Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={classNames('p-6 rounded-lg border border-red-500/20', 'bg-red-500/5 text-center')}>
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-red-500 mb-2">Something went wrong</h3>
          <p className="text-sm text-red-400 mb-4">There was an error loading the local providers section.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm font-medium',
              'bg-red-500/10 text-red-500',
              'hover:bg-red-500/20',
              'transition-colors duration-200',
            )}
          >
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-red-400 hover:text-red-300">Error Details</summary>
              <pre className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-300 overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
