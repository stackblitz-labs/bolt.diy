import React, { useState, useCallback, useEffect } from 'react';
import { GITHUB_CONFIG } from './config';
import { useSettings } from '~/lib/hooks/useSettings';

interface GitHubAuthProps {
  onAuthComplete?: (token: string) => void;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
}

interface GitHubErrorResponse {
  error?: string;
  error_description?: string;
}

interface DeviceCodeResponse extends GitHubErrorResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse extends GitHubErrorResponse {
  access_token?: string;
}

export function GitHubAuth({ onAuthComplete, onError, children }: GitHubAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const { isGitHubAuth } = useSettings();

  // Reset states when auth completes
  const handleAuthSuccess = useCallback(
    (token: string) => {
      setUserCode(null);
      setVerificationUrl(null);
      setIsPolling(false);
      setIsLoading(false);
      onAuthComplete?.(token);
    },
    [onAuthComplete],
  );

  const pollForToken = useCallback(
    async (code: string, interval: number, attempts = 0) => {
      if (attempts >= GITHUB_CONFIG.maxPollAttempts) {
        setIsPolling(false);
        onError?.(new Error('Authentication timed out. Please try again.'));

        return;
      }

      try {
        const params = new URLSearchParams({
          endpoint: GITHUB_CONFIG.accessTokenEndpoint,
          client_id: GITHUB_CONFIG.clientId,
          device_code: code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });

        const response = await fetch(`/api/github/proxy?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const data = (await response.json()) as AccessTokenResponse;

        if (data.error === 'authorization_pending') {
          // Authorization is pending, continue polling
          setTimeout(() => pollForToken(code, interval, attempts + 1), interval * 1000);
          return;
        }

        if (data.error || data.error_description) {
          throw new Error(data.error_description || data.error || 'Authentication failed');
        }

        if (!data.access_token) {
          throw new Error('Invalid response from GitHub');
        }

        localStorage.setItem('github_token', data.access_token);
        handleAuthSuccess(data.access_token);
      } catch (error: any) {
        setIsPolling(false);
        onError?.(error);
      }
    },
    [onAuthComplete, onError],
  );

  const handleStartAuth = useCallback(async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams({
        endpoint: GITHUB_CONFIG.deviceCodeEndpoint,
        client_id: GITHUB_CONFIG.clientId,
        scope: GITHUB_CONFIG.scope,
      });

      const response = await fetch(`/api/github/proxy?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as DeviceCodeResponse;

      if (data.error || data.error_description) {
        throw new Error(data.error_description || data.error || 'Failed to start authentication process');
      }

      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error('Invalid response from GitHub');
      }

      setUserCode(data.user_code);
      setVerificationUrl(data.verification_uri);
      setIsPolling(true);

      pollForToken(data.device_code, data.interval || 5);
    } catch (error: any) {
      setIsLoading(false);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [pollForToken, onError]);

  useEffect(() => {
    if (!children) {
      handleStartAuth();
    }
  }, []);

  useEffect(() => {
    return () => {
      setIsPolling(false);
      setIsLoading(false);
    };
  }, []);

  const handleCopyCode = useCallback(() => {
    if (userCode) {
      navigator.clipboard.writeText(userCode);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [userCode]);

  if (!isGitHubAuth) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin" />
        <p className="text-bolt-elements-textSecondary">Initializing GitHub authentication...</p>
      </div>
    );
  }

  if (userCode && verificationUrl) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-bolt-elements-textSecondary">
          Enter this code at{' '}
          <a
            href={verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-600"
          >
            {verificationUrl}
          </a>
        </p>
        <div className="flex items-center gap-2">
          <code className="bg-bolt-elements-background-depth-1 px-4 py-2 rounded-lg text-lg font-mono text-bolt-elements-textPrimary">
            {userCode}
          </code>
          <button
            onClick={handleCopyCode}
            className="text-blue-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-2"
          >
            {showCopied ? <div className="i-ph:check text-xl" /> : <div className="i-ph:copy text-xl" />}
          </button>
        </div>
        {isPolling && (
          <p className="text-sm text-bolt-elements-textSecondary">
            Waiting for authorization... You can close the GitHub window once authorized.
          </p>
        )}
      </div>
    );
  }

  if (!children) {
    return null;
  }

  return React.cloneElement(children as React.ReactElement, {
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      handleStartAuth();
      (children as React.ReactElement).props.onClick?.(e);
    },
  });
}
