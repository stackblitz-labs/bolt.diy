/**
 * Auth Error Boundary Component
 *
 * Catches and handles authentication-related errors in the component tree.
 * Provides user-friendly error messages and recovery options.
 *
 * Based on specs/002-better-auth/tasks.md (T033)
 */

import React from 'react';
import { useNavigate } from '@remix-run/react';

interface AuthErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface AuthErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

/**
 * Auth Error Boundary
 *
 * Catches authentication errors and displays a user-friendly message
 */
export class AuthErrorBoundary extends React.Component<AuthErrorBoundaryProps, AuthErrorBoundaryState> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    // Check if error is auth-related
    const isAuthError =
      error.message?.includes('auth') ||
      error.message?.includes('session') ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('401') ||
      error.message?.includes('403');

    if (isAuthError) {
      return {
        hasError: true,
        error,
      };
    }

    // Re-throw non-auth errors
    return { hasError: false, error: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log auth errors for debugging
    console.error('[AuthErrorBoundary] Auth error caught:', error, errorInfo);
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultAuthErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default Auth Error Fallback Component
 */
function DefaultAuthErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const navigate = useNavigate();

  const handleRetry = () => {
    resetError();
    window.location.reload();
  };

  const handleSignIn = () => {
    navigate('/auth/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-red-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600">
            We encountered an issue with your authentication session. This may happen if your session expired or there
            was a problem connecting to the authentication service.
          </p>
        </div>

        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error.message || 'Unknown authentication error'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSignIn}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Sign In Again
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
