import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { db } from '~/lib/persistence/useChatHistory';
import { getMCPConfig, saveMCPConfig } from '~/lib/persistence/db';
import { logStore } from '~/lib/stores/logs';

export interface MCPConfig {
  mcpServers: Record<
    string,
    {
      command?: string;
      args?: string[];
      url?: string;
      env?: Record<string, string>;
      type?: string;
    }
  >;
}

// Create an event dispatcher to notify when the config changes
export const mcpConfigEvents = {
  listeners: new Set<() => void>(),

  addListener(callback: () => void) {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  },

  notifyChange() {
    this.listeners.forEach((callback) => callback());
  },
};

export function useMCPConfig() {
  const [config, setConfig] = useState<MCPConfig | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const loadConfigFromDB = async () => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const savedConfig = await getMCPConfig(db);

      if (savedConfig) {
        setConfig(savedConfig);
      } else {
        setConfig(null);
      }
    } catch (error) {
      logStore.logError('Failed to load MCP config', error as Error, {
        component: 'MCPConfig',
        action: 'load',
        type: 'error',
        message: 'Failed to load MCP configuration from IndexedDB',
      });
      console.error('Error loading MCP config:', error);
      setConfig(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigFromDB();

    // Add listener for config changes from other components
    const cleanup = mcpConfigEvents.addListener(() => {
      loadConfigFromDB();
      setLastUpdate(Date.now());
    });

    return cleanup;
  }, []);

  const updateConfig = async (newConfig: MCPConfig) => {
    if (!db) {
      toast.error('Database is not available');
      return;
    }

    try {
      await saveMCPConfig(db, newConfig);
      setConfig(newConfig);
      setLastUpdate(Date.now());

      // Notify other components that the config has changed
      mcpConfigEvents.notifyChange();

      toast.success('MCP configuration saved');
    } catch (error) {
      logStore.logError('Failed to save MCP config', error as Error, {
        component: 'MCPConfig',
        action: 'save',
        type: 'error',
        message: 'Failed to save MCP configuration to IndexedDB',
      });
      toast.error('Failed to save MCP configuration');
    }
  };

  return {
    config,
    updateConfig,
    lastUpdate,
    isLoading,
  };
}
