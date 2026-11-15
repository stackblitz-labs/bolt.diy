import { useState, useEffect, useCallback } from 'react';
import { localModelHealthMonitor, type ModelHealthStatus } from '~/lib/services/localModelHealthMonitor';

export interface UseLocalModelHealthOptions {
  autoStart?: boolean;
  checkInterval?: number;
}

export interface UseLocalModelHealthReturn {
  healthStatuses: ModelHealthStatus[];
  getHealthStatus: (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => ModelHealthStatus | undefined;
  startMonitoring: (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string, checkInterval?: number) => void;
  stopMonitoring: (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => void;
  performHealthCheck: (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => Promise<void>;
  isHealthy: (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => boolean;
  getOverallHealth: () => { healthy: number; unhealthy: number; checking: number; unknown: number };
}

/**
 * React hook for monitoring local model health
 */
export function useLocalModelHealth(options: UseLocalModelHealthOptions = {}): UseLocalModelHealthReturn {
  const { checkInterval } = options;
  const [healthStatuses, setHealthStatuses] = useState<ModelHealthStatus[]>([]);

  // Update health statuses when they change
  useEffect(() => {
    const handleStatusChanged = (status: ModelHealthStatus) => {
      setHealthStatuses((current) => {
        const index = current.findIndex((s) => s.provider === status.provider && s.baseUrl === status.baseUrl);

        if (index >= 0) {
          const updated = [...current];
          updated[index] = status;

          return updated;
        } else {
          return [...current, status];
        }
      });
    };

    localModelHealthMonitor.on('statusChanged', handleStatusChanged);

    // Initialize with current statuses
    setHealthStatuses(localModelHealthMonitor.getAllHealthStatuses());

    return () => {
      localModelHealthMonitor.off('statusChanged', handleStatusChanged);
    };
  }, []);

  // Get health status for a specific provider
  const getHealthStatus = useCallback((provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => {
    return localModelHealthMonitor.getHealthStatus(provider, baseUrl);
  }, []);

  // Start monitoring a provider
  const startMonitoring = useCallback(
    (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string, interval?: number) => {
      console.log(`[Health Monitor] Starting monitoring for ${provider} at ${baseUrl}`);
      localModelHealthMonitor.startMonitoring(provider, baseUrl, interval || checkInterval);
    },
    [checkInterval],
  );

  // Stop monitoring a provider
  const stopMonitoring = useCallback((provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => {
    console.log(`[Health Monitor] Stopping monitoring for ${provider} at ${baseUrl}`);
    localModelHealthMonitor.stopMonitoring(provider, baseUrl);

    // Remove from local state
    setHealthStatuses((current) => current.filter((s) => !(s.provider === provider && s.baseUrl === baseUrl)));
  }, []);

  // Perform manual health check
  const performHealthCheck = useCallback(async (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => {
    await localModelHealthMonitor.performHealthCheck(provider, baseUrl);
  }, []);

  // Check if a provider is healthy
  const isHealthy = useCallback(
    (provider: 'Ollama' | 'LMStudio' | 'OpenAILike', baseUrl: string) => {
      const status = getHealthStatus(provider, baseUrl);
      return status?.status === 'healthy';
    },
    [getHealthStatus],
  );

  // Get overall health statistics
  const getOverallHealth = useCallback(() => {
    const stats = { healthy: 0, unhealthy: 0, checking: 0, unknown: 0 };

    healthStatuses.forEach((status) => {
      stats[status.status]++;
    });

    return stats;
  }, [healthStatuses]);

  return {
    healthStatuses,
    getHealthStatus,
    startMonitoring,
    stopMonitoring,
    performHealthCheck,
    isHealthy,
    getOverallHealth,
  };
}

/**
 * Hook for monitoring a specific provider
 */
export function useProviderHealth(
  provider: 'Ollama' | 'LMStudio' | 'OpenAILike',
  baseUrl: string,
  options: UseLocalModelHealthOptions = {},
) {
  const { autoStart = true, checkInterval } = options;
  const { getHealthStatus, startMonitoring, stopMonitoring, performHealthCheck, isHealthy } = useLocalModelHealth();

  const [status, setStatus] = useState<ModelHealthStatus | undefined>();

  // Update status when it changes
  useEffect(() => {
    const updateStatus = () => {
      setStatus(getHealthStatus(provider, baseUrl));
    };

    const handleStatusChanged = (changedStatus: ModelHealthStatus) => {
      if (changedStatus.provider === provider && changedStatus.baseUrl === baseUrl) {
        setStatus(changedStatus);
      }
    };

    localModelHealthMonitor.on('statusChanged', handleStatusChanged);
    updateStatus();

    return () => {
      localModelHealthMonitor.off('statusChanged', handleStatusChanged);
    };
  }, [provider, baseUrl, getHealthStatus]);

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (autoStart && baseUrl) {
      startMonitoring(provider, baseUrl, checkInterval);

      return () => {
        stopMonitoring(provider, baseUrl);
      };
    }

    return undefined;
  }, [autoStart, provider, baseUrl, checkInterval, startMonitoring, stopMonitoring]);

  return {
    status,
    isHealthy: isHealthy(provider, baseUrl),
    performHealthCheck: () => performHealthCheck(provider, baseUrl),
    startMonitoring: (interval?: number) => startMonitoring(provider, baseUrl, interval),
    stopMonitoring: () => stopMonitoring(provider, baseUrl),
  };
}
