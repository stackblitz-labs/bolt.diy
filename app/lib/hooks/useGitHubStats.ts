import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import type { GitHubStats, GitHubConnection } from '~/types/GitHub';
import { gitHubApiService } from '~/lib/services/githubApiService';

export interface UseGitHubStatsState {
  stats: GitHubStats | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseGitHubStatsOptions {
  autoFetch?: boolean;
  refreshInterval?: number; // in milliseconds
  cacheTimeout?: number; // in milliseconds
}

export interface UseGitHubStatsReturn extends UseGitHubStatsState {
  fetchStats: () => Promise<void>;
  refreshStats: () => Promise<void>;
  clearStats: () => void;
  isStale: boolean;
}

const STATS_CACHE_KEY = 'github_stats_cache';
const DEFAULT_CACHE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function useGitHubStats(
  connection: GitHubConnection | null,
  options: UseGitHubStatsOptions = {},
  isServerSide: boolean = false,
): UseGitHubStatsReturn {
  const { autoFetch = false, refreshInterval, cacheTimeout = DEFAULT_CACHE_TIMEOUT } = options;

  const [state, setState] = useState<UseGitHubStatsState>({
    stats: null,
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  // Configure API service when connection is available
  const apiService = useMemo(() => {
    if (!connection?.token) {
      return null;
    }

    // Configure the singleton instance with the current connection
    gitHubApiService.configure({
      token: connection.token,
      tokenType: connection.tokenType,
    });

    return gitHubApiService;
  }, [connection?.token, connection?.tokenType]);

  // Check if stats are stale
  const isStale = useMemo(() => {
    if (!state.lastUpdated || !state.stats) {
      return true;
    }

    return Date.now() - state.lastUpdated.getTime() > cacheTimeout;
  }, [state.lastUpdated, state.stats, cacheTimeout]);

  // Load cached stats on mount
  useEffect(() => {
    loadCachedStats();
  }, []);

  // Auto-fetch stats when connection changes - with better handling
  useEffect(() => {
    if (autoFetch && connection && (!state.stats || isStale)) {
      /*
       * For server-side connections, always try to fetch
       * For client-side connections, only fetch if we have an API service
       */
      if (isServerSide || apiService) {
        // Use a timeout to prevent immediate fetching on mount
        const timeoutId = setTimeout(() => {
          fetchStats().catch((error) => {
            console.warn('Failed to auto-fetch stats:', error);

            // Don't throw error on auto-fetch to prevent crashes
          });
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }

    return undefined;
  }, [autoFetch, connection, apiService, state.stats, isStale, isServerSide]);

  // Set up refresh interval if provided
  useEffect(() => {
    if (!refreshInterval || !connection) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (isStale) {
        refreshStats();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, connection, isStale]);

  const loadCachedStats = useCallback(() => {
    try {
      const cached = localStorage.getItem(STATS_CACHE_KEY);

      if (cached) {
        const { stats, timestamp, userLogin } = JSON.parse(cached);

        // Only use cached data if it's for the current user
        if (userLogin === connection?.user?.login) {
          setState((prev) => ({
            ...prev,
            stats,
            lastUpdated: new Date(timestamp),
          }));
        }
      }
    } catch (error) {
      console.error('Error loading cached stats:', error);

      // Clear corrupted cache
      localStorage.removeItem(STATS_CACHE_KEY);
    }
  }, [connection?.user?.login]);

  const saveCachedStats = useCallback((stats: GitHubStats, userLogin: string) => {
    try {
      const cacheData = {
        stats,
        timestamp: Date.now(),
        userLogin,
      };
      localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving stats to cache:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!connection?.user) {
      setState((prev) => ({
        ...prev,
        error: 'GitHub connection not available',
        isLoading: false,
        isRefreshing: false,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: !prev.stats, // Show loading only if no stats yet
      isRefreshing: !!prev.stats, // Show refreshing if stats exist
      error: null,
    }));

    try {
      let stats: GitHubStats;

      if (isServerSide || !connection.token) {
        // Use server-side API for stats
        const response = await fetch('/api/github-stats');

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('GitHub authentication required');
          }

          const errorData: any = await response.json();
          throw new Error(errorData.error || 'Failed to fetch stats from server');
        }

        stats = await response.json();
      } else {
        // Use client-side API service for stats
        if (!apiService) {
          throw new Error('GitHub API service not available');
        }

        stats = await apiService.generateComprehensiveStats(connection.user);
      }

      const now = new Date();

      setState((prev) => ({
        ...prev,
        stats,
        isLoading: false,
        isRefreshing: false,
        lastUpdated: now,
        error: null,
      }));

      // Cache the stats
      saveCachedStats(stats, connection.user.login);

      // Update the connection object with stats if needed
      if (connection.stats?.lastUpdated !== stats.lastUpdated) {
        const updatedConnection = {
          ...connection,
          stats,
        };
        localStorage.setItem('github_connection', JSON.stringify(updatedConnection));
      }

      // Only show success toast for manual refreshes, not auto-fetches
      if (state.isRefreshing) {
        toast.success('GitHub stats updated successfully');
      }
    } catch (error) {
      console.error('Error fetching GitHub stats:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch GitHub stats';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage,
      }));

      // Only show error toast for manual actions, not auto-fetches
      if (state.isRefreshing) {
        toast.error(`Failed to update GitHub stats: ${errorMessage}`);
      }

      throw error;
    }
  }, [apiService, connection, saveCachedStats, isServerSide]);

  const refreshStats = useCallback(async () => {
    if (state.isRefreshing || state.isLoading) {
      return; // Prevent multiple simultaneous requests
    }

    await fetchStats();
  }, [fetchStats, state.isRefreshing, state.isLoading]);

  const clearStats = useCallback(() => {
    setState({
      stats: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      lastUpdated: null,
    });

    // Clear cache
    localStorage.removeItem(STATS_CACHE_KEY);
  }, []);

  return {
    ...state,
    fetchStats,
    refreshStats,
    clearStats,
    isStale,
  };
}

// Helper hook for lightweight stats fetching (just repositories)
export function useGitHubRepositories(connection: GitHubConnection | null) {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiService = useMemo(() => {
    if (!connection?.token) {
      return null;
    }

    // Configure the singleton instance with the current connection
    gitHubApiService.configure({
      token: connection.token,
      tokenType: connection.tokenType,
    });

    return gitHubApiService;
  }, [connection?.token, connection?.tokenType]);

  const fetchRepositories = useCallback(async () => {
    if (!apiService) {
      setError('GitHub connection not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const repos = await apiService.getAllUserRepositories();
      setRepositories(repos);
    } catch (error) {
      console.error('Error fetching repositories:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch repositories';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiService]);

  return {
    repositories,
    isLoading,
    error,
    fetchRepositories,
  };
}
