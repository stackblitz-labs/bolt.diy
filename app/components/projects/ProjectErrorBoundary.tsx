/**
 * Project Error Boundary Component
 *
 * Catches and handles project-related API errors in the component tree.
 * Provides user-friendly error messages and recovery options for common
 * project management error scenarios.
 *
 * Phase 8, Task T050 - Global error boundary for project API errors
 */

import React from 'react';
import { useNavigate } from '@remix-run/react';

interface ProjectErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorType?: '401' | '403' | '500' | 'network' | 'unknown';
}

interface ProjectErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void; errorType?: string }>;
}

/**
 * Project Error Boundary
 *
 * Catches project-related errors and displays appropriate user-friendly messages
 */
export class ProjectErrorBoundary extends React.Component<ProjectErrorBoundaryProps, ProjectErrorBoundaryState> {
  constructor(props: ProjectErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: undefined,
    };
  }

  static getDerivedStateFromError(error: Error): ProjectErrorBoundaryState {
    // Classify error type for better UX
    let errorType: ProjectErrorBoundaryState['errorType'] = 'unknown';

    const errorMessage = error.message?.toLowerCase() || '';
    const errorStack = error.stack?.toLowerCase() || '';

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorStack.includes('401')) {
      errorType = '401';
    } else if (
      errorMessage.includes('403') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('limit reached') ||
      errorStack.includes('403')
    ) {
      errorType = '403';
    } else if (
      errorMessage.includes('500') ||
      errorMessage.includes('internal server error') ||
      errorMessage.includes('server error') ||
      errorStack.includes('500')
    ) {
      errorType = '500';
    } else if (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorStack.includes('network')
    ) {
      errorType = 'network';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log project errors for debugging
    console.error('[ProjectErrorBoundary] Project error caught:', error, errorInfo);

    // In production, you might want to send this to an error reporting service
    if (typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
      // Example: sendErrorToService(error, errorInfo, 'project');
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorType: undefined,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultProjectErrorFallback;
      return (
        <FallbackComponent error={this.state.error} resetError={this.resetError} errorType={this.state.errorType} />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Project Error Fallback Component
 */
function DefaultProjectErrorFallback({
  error,
  resetError,
  errorType,
}: {
  error: Error;
  resetError: () => void;
  errorType?: string;
}) {
  const navigate = useNavigate();

  const handleRetry = () => {
    resetError();
    window.location.reload();
  };

  const handleSignIn = () => {
    navigate('/auth/login');
  };

  const handleGoHome = () => {
    navigate('/app');
  };

  const getErrorContent = () => {
    switch (errorType) {
      case '401':
        return {
          title: 'Authentication Required',
          description: 'Please sign in to access your projects.',
          icon: '🔐',
          primaryAction: { label: 'Sign In', handler: handleSignIn },
          secondaryAction: { label: 'Retry', handler: handleRetry },
        };

      case '403':
        return {
          title: 'Project Limit Reached',
          description:
            "You've reached the maximum number of projects (10). Upgrade your plan or delete existing projects to create new ones.",
          icon: '📊',
          primaryAction: { label: 'Manage Projects', handler: handleGoHome },
          secondaryAction: { label: 'Retry', handler: handleRetry },
        };

      case '500':
        return {
          title: 'Server Error',
          description: 'We encountered an unexpected error. Please try again in a moment.',
          icon: '⚠️',
          primaryAction: { label: 'Retry', handler: handleRetry },
          secondaryAction: { label: 'Go to Dashboard', handler: handleGoHome },
        };

      case 'network':
        return {
          title: 'Connection Error',
          description: 'Unable to connect to the server. Please check your internet connection and try again.',
          icon: '🌐',
          primaryAction: { label: 'Retry', handler: handleRetry },
          secondaryAction: { label: 'Go to Dashboard', handler: handleGoHome },
        };

      default:
        return {
          title: 'Something went wrong',
          description: 'An unexpected error occurred while managing your projects.',
          icon: '❌',
          primaryAction: { label: 'Retry', handler: handleRetry },
          secondaryAction: { label: 'Go to Dashboard', handler: handleGoHome },
        };
    }
  };

  const errorContent = getErrorContent();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-red-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
            {errorContent.icon}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{errorContent.title}</h2>
          <p className="mt-2 text-sm text-gray-600">{errorContent.description}</p>
        </div>

        {/* Show technical error details in development */}
        {import.meta.env.DEV && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
            <p className="text-sm text-yellow-800">
              <strong>Development Error:</strong> {error.message || 'Unknown error'}
            </p>
            {error.stack && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-yellow-700">Stack trace</summary>
                <pre className="mt-1 text-xs text-yellow-600 whitespace-pre-wrap">{error.stack}</pre>
              </details>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={errorContent.primaryAction.handler}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            {errorContent.primaryAction.label}
          </button>
          <button
            onClick={errorContent.secondaryAction.handler}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {errorContent.secondaryAction.label}
          </button>
        </div>
      </div>
    </div>
  );
}
