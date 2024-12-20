import { useCallback, useEffect, useState } from 'react';
import { getGitHubUser, type GitHubUser } from './github.client';
import { isGitHubAuthEnabled } from '~/lib/stores/settings';
import { useStore } from '@nanostores/react';

export function useGitHubAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const isGitHubAuth = useStore(isGitHubAuthEnabled);

  const checkAuth = useCallback(async () => {
    // If GitHub auth is disabled, don't authenticate
    if (!isGitHubAuth) {
      if (isAuthenticated) {
        // Only clear if we were previously authenticated
        setIsAuthenticated(false);
        setUser(null);
        localStorage.removeItem('github_token');
      }

      setIsLoading(false);

      return;
    }

    const token = localStorage.getItem('github_token');

    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      setIsLoading(false);

      return;
    }

    try {
      const userInfo = await getGitHubUser(token);
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      // Only remove token if it's an auth error (401 or 403)
      if (error instanceof Error && 'status' in error && (error.status === 401 || error.status === 403)) {
        localStorage.removeItem('github_token');
      }

      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [isGitHubAuth, isAuthenticated]);

  // Initial auth check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle GitHub auth toggle
  useEffect(() => {
    if (!isGitHubAuth && isAuthenticated) {
      // Clear auth when feature is disabled
      setIsAuthenticated(false);
      setUser(null);
      localStorage.removeItem('github_token');
    } else if (isGitHubAuth && !isAuthenticated) {
      // Try to authenticate when feature is enabled
      checkAuth();
    }
  }, [isGitHubAuth, isAuthenticated, checkAuth]);

  // Re-run auth check when window regains focus
  useEffect(() => {
    window.addEventListener('focus', checkAuth);

    return () => {
      window.removeEventListener('focus', checkAuth);
    };
  }, [checkAuth]);

  const handleAuthComplete = useCallback(async (token: string) => {
    try {
      const userInfo = await getGitHubUser(token);
      setUser(userInfo);
      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem('github_token');
      setIsAuthenticated(false);
      setUser(null);
      throw error;
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('github_token');
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    handleAuthComplete,
    handleLogout,
  };
}
