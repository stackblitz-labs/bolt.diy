import { useStore } from '@nanostores/react';
import type { WritableAtom } from 'nanostores';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { removeSecureCookie, setSecureCookie } from '~/lib/api/secure-cookies';
import { logStore } from '~/lib/stores/logs';

export interface ServiceConnectionState<TUser = any, TStats = any> {
  isConnected: boolean;
  token: string;
  user?: TUser;
  stats?: TStats;
  lastUpdated?: string;
}

export interface ServiceConnectionConfig<TUser = any, TStats = any> {
  serviceName: string;
  connectionAtom: WritableAtom<ServiceConnectionState<TUser, TStats>>;
  connectingAtom?: WritableAtom<boolean>;
  tokenCookieName: string;
  testEndpoint?: string;
  fetchStatsEndpoint?: string;
  initializeConnection?: () => Promise<void>;
  onConnect?: (token: string) => Promise<ServiceConnectionState<TUser, TStats>>;
  onDisconnect?: () => Promise<void>;
}

export interface UseServiceConnectionResult<TUser = any, TStats = any> {
  connection: ServiceConnectionState<TUser, TStats>;
  isConnecting: boolean;
  isConnected: boolean;
  connect: (token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  updateConnection: (updates: Partial<ServiceConnectionState<TUser, TStats>>) => void;
  refreshStats: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

/**
 * Shared hook for managing service connections (GitHub, GitLab, Netlify, Vercel, etc.)
 * Provides consistent connection state management, authentication, and error handling.
 */
export function useServiceConnection<TUser = any, TStats = any>(
  config: ServiceConnectionConfig<TUser, TStats>,
): UseServiceConnectionResult<TUser, TStats> {
  const connection = useStore(config.connectionAtom);
  const isConnecting = config.connectingAtom ? useStore(config.connectingAtom) : false;
  const [localConnecting, setLocalConnecting] = useState(false);

  const actualIsConnecting = config.connectingAtom ? isConnecting : localConnecting;

  // Initialize connection on mount
  useEffect(() => {
    if (config.initializeConnection) {
      config.initializeConnection().catch((error) => {
        logStore.logError(`Failed to initialize ${config.serviceName} connection`, error);
      });
    }
  }, [config]);

  const updateConnection = useCallback(
    (updates: Partial<ServiceConnectionState<TUser, TStats>>) => {
      config.connectionAtom.set({
        ...connection,
        ...updates,
      });
    },
    [config.connectionAtom, connection],
  );

  const connect = useCallback(
    async (token: string) => {
      if (!token.trim()) {
        toast.error(`Please provide a valid ${config.serviceName} token`);
        return;
      }

      if (!config.connectingAtom) {
        setLocalConnecting(true);
      }

      try {
        // Store token securely
        await setSecureCookie(config.tokenCookieName, token);

        let connectionState: Partial<ServiceConnectionState<TUser, TStats>> = {
          token,
          isConnected: true,
        };

        // If custom connect handler provided, use it
        if (config.onConnect) {
          const result = await config.onConnect(token);
          connectionState = { ...connectionState, ...result };
        }

        updateConnection(connectionState);
        toast.success(`Connected to ${config.serviceName} successfully`);

        // Test connection if endpoint provided
        if (config.testEndpoint) {
          await testConnection();
        }
      } catch (error) {
        logStore.logError(`Failed to connect to ${config.serviceName}`, error);
        toast.error(
          `Failed to connect to ${config.serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw error;
      } finally {
        if (!config.connectingAtom) {
          setLocalConnecting(false);
        }
      }
    },
    [config, updateConnection],
  );

  const disconnect = useCallback(async () => {
    try {
      // Custom disconnect handler
      if (config.onDisconnect) {
        await config.onDisconnect();
      }

      // Remove secure cookie
      await removeSecureCookie(config.tokenCookieName);

      // Reset connection state
      updateConnection({
        isConnected: false,
        token: '',
        user: undefined,
        stats: undefined,
        lastUpdated: undefined,
      });

      toast.success(`Disconnected from ${config.serviceName}`);
    } catch (error) {
      logStore.logError(`Failed to disconnect from ${config.serviceName}`, error);
      toast.error(`Failed to disconnect from ${config.serviceName}`);
      throw error;
    }
  }, [config, updateConnection]);

  const refreshStats = useCallback(async () => {
    if (!connection.token || !config.fetchStatsEndpoint) {
      return;
    }

    try {
      const response = await fetch(config.fetchStatsEndpoint, {
        headers: {
          Authorization: `Bearer ${connection.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }

      const stats = (await response.json()) as TStats;

      updateConnection({
        stats,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logStore.logError(`Failed to refresh ${config.serviceName} stats`, error);
      toast.error(`Failed to refresh ${config.serviceName} stats`);
      throw error;
    }
  }, [connection.token, config.fetchStatsEndpoint, config.serviceName, updateConnection]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!connection.token || !config.testEndpoint) {
      return false;
    }

    try {
      const response = await fetch(config.testEndpoint, {
        headers: {
          Authorization: `Bearer ${connection.token}`,
        },
      });

      return response.ok;
    } catch (error) {
      logStore.logError(`${config.serviceName} connection test failed`, error);
      return false;
    }
  }, [connection.token, config.testEndpoint, config.serviceName]);

  return {
    connection,
    isConnecting: actualIsConnecting,
    isConnected: connection.isConnected,
    connect,
    disconnect,
    updateConnection,
    refreshStats,
    testConnection,
  };
}
