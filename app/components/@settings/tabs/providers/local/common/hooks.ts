import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from '~/lib/localStorage/useLocalStorage';
import type { ProviderKey, ProviderSettings, ModelInfo } from './types';
import { useSettings } from '~/lib/hooks/useSettings';
import { PROVIDER_DEFAULT_URLS } from './types';

// Cache for API responses to reduce redundant calls
const apiCache: Record<string, { data: any; timestamp: number }> = {};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Debounce delay for API calls in milliseconds
const API_CALL_DEBOUNCE = 1000;

/**
 * Default provider settings
 */
export const DEFAULT_PROVIDER_SETTINGS: Record<ProviderKey, Required<ProviderSettings>> = {
  Ollama: {
    enabled: false,
    baseUrl: import.meta.env.VITE_OLLAMA_API_BASE_URL || PROVIDER_DEFAULT_URLS.Ollama,
    apiKey: '',
  },
  LMStudio: {
    enabled: false,
    baseUrl: import.meta.env.LMSTUDIO_API_BASE_URL || PROVIDER_DEFAULT_URLS.LMStudio,
    apiKey: '',
  },
  OpenAILike: {
    enabled: false,
    baseUrl: import.meta.env.OPENAI_LIKE_API_BASE_URL || PROVIDER_DEFAULT_URLS.OpenAILike,
    apiKey: '',
  },
};

/**
 * Hook to manage provider settings
 */
export function useProviderSettings(providerKey: ProviderKey) {
  const { providers, updateProviderSettings } = useSettings();
  const [storedSettings, setStoredSettings] = useLocalStorage<Record<ProviderKey, Required<ProviderSettings>>>(
    'local-provider-settings',
    DEFAULT_PROVIDER_SETTINGS,
  );

  // Get settings from the main providers store if available, otherwise use local storage
  const settings =
    providers && providers[providerKey]?.settings
      ? {
          enabled: providers[providerKey].settings.enabled ?? false,
          baseUrl: providers[providerKey].settings.baseUrl || PROVIDER_DEFAULT_URLS[providerKey],
          apiKey: providers[providerKey].settings.apiKey || '',
        }
      : storedSettings[providerKey] || DEFAULT_PROVIDER_SETTINGS[providerKey];

  // Update settings for the current provider
  const updateSettings = useCallback(
    (newSettings: Partial<ProviderSettings>) => {
      const updatedSettings = {
        ...settings,
        ...newSettings,
      };

      // Update in the main settings store
      if (providers && providers[providerKey]) {
        updateProviderSettings(providerKey, updatedSettings);
      }

      // Also update in local storage as a backup
      setStoredSettings((prev) => ({
        ...prev,
        [providerKey]: updatedSettings,
      }));
    },
    [providerKey, providers, settings, updateProviderSettings, setStoredSettings],
  );

  return {
    settings,
    updateSettings,
  };
}

/**
 * Hook to manage API requests with loading and error states
 */
export function useApiRequest<T>(requestFn: () => Promise<T>, initialData: T, dependencies: any[] = []) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cacheKeyRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    // Generate a cache key based on the function name and arguments
    const fnString = requestFn.toString();
    cacheKeyRef.current = fnString;

    // Check if we have a cached response
    if (apiCache[cacheKeyRef.current] && Date.now() - apiCache[cacheKeyRef.current].timestamp < CACHE_EXPIRATION) {
      setData(apiCache[cacheKeyRef.current].data);
      return;
    }

    // Clear any existing timeout
    if (requestTimeoutRef.current) {
      clearTimeout(requestTimeoutRef.current);
    }

    // Debounce the API call
    requestTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await requestFn();
        setData(result);

        // Cache the response
        apiCache[cacheKeyRef.current] = {
          data: result,
          timestamp: Date.now(),
        };
      } catch (err) {
        console.error('API request error:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
        requestTimeoutRef.current = null;
      }
    }, API_CALL_DEBOUNCE);
  }, [requestFn]);

  useEffect(() => {
    fetchData();

    // Cleanup function to clear timeout
    return () => {
      if (requestTimeoutRef.current) {
        clearTimeout(requestTimeoutRef.current);
      }
    };
  }, [fetchData, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook to check if a server is running
 */
export function useServerStatus(checkFn: () => Promise<boolean>, enabled: boolean, dependencies: any[] = []) {
  const [isRunning, setIsRunning] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);

  // Minimum time between status checks (10 seconds)
  const MIN_CHECK_INTERVAL = 10000;

  const checkStatus = useCallback(async () => {
    if (!enabled) {
      setIsRunning(false);
      return;
    }

    // Prevent too frequent checks
    const now = Date.now();

    if (now - lastCheckRef.current < MIN_CHECK_INTERVAL) {
      return;
    }

    // Clear any existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    setIsChecking(true);
    lastCheckRef.current = now;

    try {
      const isRunning = await checkFn();
      setIsRunning(isRunning);
    } catch (error) {
      console.error('Error checking server status:', error);
      setIsRunning(false);
    } finally {
      setIsChecking(false);
    }
  }, [enabled, checkFn]);

  useEffect(() => {
    checkStatus();

    // Set up a polling interval for enabled servers
    let pollInterval: NodeJS.Timeout | null = null;

    if (enabled) {
      // Check every 30 seconds instead of continuously
      pollInterval = setInterval(checkStatus, 30000);
    }

    // Cleanup function
    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [checkStatus, enabled, ...dependencies]);

  return {
    isRunning,
    isChecking,
    checkStatus,
  };
}

/**
 * Hook to manage model list with caching
 */
export function useModelList(providerKey: ProviderKey, apiClient: any | null, isServerRunning: boolean | null) {
  const cacheKey = `models-${providerKey}`;
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchModels = async () => {
      if (!apiClient || !isServerRunning) {
        setModels([]);
        return;
      }

      // Check if we have cached models
      if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_EXPIRATION) {
        setModels(apiCache[cacheKey].data);
        return;
      }

      // Don't fetch if we're already fetching
      if (isFetchingRef.current) {
        console.log(`${providerKey} models are already being fetched, skipping duplicate fetch`);
        return;
      }

      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      isFetchingRef.current = true;

      // Debounce the fetch
      fetchTimeoutRef.current = setTimeout(async () => {
        setIsLoading(true);

        try {
          const modelList = await apiClient.getModels();
          console.log(`${providerKey} models fetched successfully:`, modelList);
          setModels(modelList);
          setError(null);

          // Cache the response
          apiCache[cacheKey] = {
            data: modelList,
            timestamp: Date.now(),
          };
        } catch (err) {
          console.error(`Error fetching ${providerKey} models:`, err);

          // Try using the proxy method for LM Studio if available
          if (providerKey === 'LMStudio' && apiClient.getModelsViaProxy) {
            try {
              console.log('Attempting to fetch LM Studio models via proxy');

              const proxyModelList = await apiClient.getModelsViaProxy();
              console.log('LM Studio proxy models fetched:', proxyModelList);

              if (proxyModelList && proxyModelList.length > 0) {
                console.log('Successfully fetched LM Studio models via proxy, count:', proxyModelList.length);
                setModels(proxyModelList);
                console.log('Models state updated with proxy models');
                setError(null);

                // Cache the response
                apiCache[cacheKey] = {
                  data: proxyModelList,
                  timestamp: Date.now(),
                };

                return;
              } else {
                console.log('Proxy returned empty model list');
              }
            } catch (proxyErr) {
              console.error('Failed to fetch LM Studio models via proxy:', proxyErr);
            }
          }

          setError(err instanceof Error ? err.message : 'Failed to fetch models');
          console.log('Setting error state:', err instanceof Error ? err.message : 'Failed to fetch models');
          setModels([]);
          console.log('Models state reset to empty array');
        } finally {
          setIsLoading(false);
          isFetchingRef.current = false;
          fetchTimeoutRef.current = null;
        }
      }, API_CALL_DEBOUNCE);
    };

    fetchModels();

    // Cleanup function
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [apiClient, isServerRunning, providerKey, cacheKey]);

  const refreshModels = useCallback(() => {
    // Don't refresh if we're already fetching
    if (isFetchingRef.current) {
      console.log(`${providerKey} models are already being fetched, skipping refresh`);
      return;
    }

    // Remove cache entry to force refresh
    if (apiCache[cacheKey]) {
      delete apiCache[cacheKey];
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce the refresh
    fetchTimeoutRef.current = setTimeout(() => {
      // Re-trigger the effect
      if (apiClient && isServerRunning) {
        setIsLoading(true);
        isFetchingRef.current = true;

        apiClient
          .getModels()
          .then((modelList: ModelInfo[]) => {
            setModels(modelList);
            setError(null);

            // Update cache
            apiCache[cacheKey] = {
              data: modelList,
              timestamp: Date.now(),
            };
          })
          .catch((err: any) => {
            console.error(`Error refreshing ${providerKey} models:`, err);
            setError(err instanceof Error ? err.message : 'Failed to refresh models');
          })
          .finally(() => {
            setIsLoading(false);
            isFetchingRef.current = false;
            fetchTimeoutRef.current = null;
          });
      }
    }, API_CALL_DEBOUNCE);
  }, [apiClient, isServerRunning, providerKey, cacheKey]);

  return { models, isLoading, error, refreshModels };
}
