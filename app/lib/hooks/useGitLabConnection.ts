import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import Cookies from 'js-cookie';
import type { GitLabConnection } from '~/types/GitLab';
import { useGitLabAPI } from './useGitLabAPI';
import { gitlabConnectionStore, gitlabConnection, isGitLabConnected } from '~/lib/stores/gitlabConnection';

export interface ConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  connection: GitLabConnection | null;
  error: string | null;
}

export interface UseGitLabConnectionReturn extends ConnectionState {
  connect: (token: string, gitlabUrl?: string) => Promise<void>;
  disconnect: () => void;
  refreshConnection: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
}

const STORAGE_KEY = 'gitlab_connection';

export function useGitLabConnection(): UseGitLabConnectionReturn {
  const connection = useStore(gitlabConnection);
  const isConnected = useStore(isGitLabConnected);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  // Create API instance - will update when connection changes
  useGitLabAPI(
    connection?.token
      ? { token: connection.token, baseUrl: connection.gitlabUrl || 'https://gitlab.com' }
      : { token: '', baseUrl: 'https://gitlab.com' },
  );

  // Load saved connection on mount
  useEffect(() => {
    loadSavedConnection();
  }, []);

  const loadSavedConnection = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if connection already exists in store (likely from initialization)
      if (connection?.user) {
        setIsLoading(false);
        return;
      }

      // Load saved connection from localStorage
      const savedConnection = localStorage.getItem(STORAGE_KEY);

      if (savedConnection) {
        const parsed = JSON.parse(savedConnection);

        if (parsed.user && parsed.token) {
          // Update the store with saved connection
          gitlabConnectionStore.setGitLabUrl(parsed.gitlabUrl || 'https://gitlab.com');
          gitlabConnectionStore.setToken(parsed.token);

          // Test the connection to make sure it's still valid
          await refreshConnectionData(parsed);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading saved connection:', error);
      setError('Failed to load saved connection');
      setIsLoading(false);

      // Clean up corrupted data
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [connection]);

  const refreshConnectionData = useCallback(async (connection: GitLabConnection) => {
    if (!connection.token) {
      return;
    }

    try {
      // Make direct API call instead of using hook
      const baseUrl = connection.gitlabUrl || 'https://gitlab.com';
      const response = await fetch(`${baseUrl}/api/v4/user`, {
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': connection.token,
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // const userData = (await response.json()) as GitLabUserResponse;
      await response.json(); // Parse response but don't store - data handled by store

      /*
       * Update connection with user data - unused variable removed
       * const updatedConnection: GitLabConnection = {
       *   ...connection,
       *   user: userData,
       * };
       */

      gitlabConnectionStore.setGitLabUrl(baseUrl);
      gitlabConnectionStore.setToken(connection.token);
    } catch (error) {
      console.error('Error refreshing connection data:', error);
    }
  }, []);

  const connect = useCallback(async (token: string, gitlabUrl = 'https://gitlab.com') => {
    if (!token.trim()) {
      setError('Token is required');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('Calling GitLab store connect method...');

      // Use the store's connect method which handles everything properly
      const result = await gitlabConnectionStore.connect(token, gitlabUrl);

      if (!result.success) {
        throw new Error(result.error || 'Connection failed');
      }

      console.log('GitLab connection successful, now fetching stats...');

      // Fetch stats after successful connection
      try {
        const statsResult = await gitlabConnectionStore.fetchStats(true);

        if (statsResult.success) {
          console.log('GitLab stats fetched successfully:', statsResult.stats);
        } else {
          console.error('Failed to fetch GitLab stats:', statsResult.error);
        }
      } catch (statsError) {
        console.error('Failed to fetch GitLab stats:', statsError);

        // Don't fail the connection if stats fail
      }

      toast.success('Connected to GitLab successfully!');
    } catch (error) {
      console.error('Failed to connect to GitLab:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to GitLab';

      setError(errorMessage);
      toast.error(`Failed to connect: ${errorMessage}`);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);

    // Clear all GitLab-related cookies
    Cookies.remove('gitlabToken');
    Cookies.remove('gitlabUsername');
    Cookies.remove('gitlabUrl');

    // Reset store
    gitlabConnectionStore.disconnect();

    setError(null);
    toast.success('Disconnected from GitLab');
  }, []);

  const refreshConnection = useCallback(async () => {
    if (!connection?.token) {
      throw new Error('No connection to refresh');
    }

    setIsLoading(true);
    setError(null);

    try {
      await refreshConnectionData(connection);
    } catch (error) {
      console.error('Error refreshing connection:', error);
      setError('Failed to refresh connection');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [connection, refreshConnectionData]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connection?.token) {
      return false;
    }

    try {
      const baseUrl = connection.gitlabUrl || 'https://gitlab.com';
      const response = await fetch(`${baseUrl}/api/v4/user`, {
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': connection.token,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }, [connection]);

  const refreshStats = useCallback(async () => {
    if (!connection?.token) {
      throw new Error('No connection to refresh stats');
    }

    try {
      const statsResult = await gitlabConnectionStore.fetchStats(true);

      if (!statsResult.success) {
        throw new Error(statsResult.error || 'Failed to refresh stats');
      }
    } catch (error) {
      console.error('Error refreshing GitLab stats:', error);
      throw error;
    }
  }, [connection]);

  return {
    isConnected,
    isLoading,
    isConnecting,
    connection,
    error,
    connect,
    disconnect,
    refreshConnection,
    testConnection,
    refreshStats,
  };
}
