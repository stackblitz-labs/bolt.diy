import { useStore } from '@nanostores/react';
import {
  isDebugMode,
  isEventLogsEnabled,
  promptStore,
  providersStore,
  latestBranchStore,
  autoSelectStarterTemplate,
  enableContextOptimizationStore,
  tabConfigurationStore,
  resetTabConfiguration as resetTabConfig,
  updateProviderSettings as updateProviderSettingsStore,
  updateLatestBranch,
  updateAutoSelectTemplate,
  updateContextOptimization,
  updateEventLogs,
  updatePromptId,
} from '~/lib/stores/settings';
import { useCallback, useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import type { IProviderSetting, ProviderInfo, IProviderConfig } from '~/types/model';
import type { TabWindowConfig } from '~/components/@settings/core/types';
import { logStore } from '~/lib/stores/logs';
import { getLocalStorage, setLocalStorage } from '~/lib/persistence';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  eventLogs: boolean;
  timezone: string;
  tabConfiguration: TabWindowConfig;
}

export interface UseSettingsReturn {
  // Theme and UI settings
  setTheme: (theme: Settings['theme']) => void;
  setLanguage: (language: string) => void;
  setNotifications: (enabled: boolean) => void;
  setEventLogs: (enabled: boolean) => void;
  setTimezone: (timezone: string) => void;
  settings: Settings;

  // Provider settings
  providers: Record<string, IProviderConfig>;
  activeProviders: ProviderInfo[];
  updateProviderSettings: (provider: string, config: IProviderSetting) => void;

  // Debug and development settings
  debug: boolean;
  enableDebugMode: (enabled: boolean) => void;
  eventLogs: boolean;
  promptId: string;
  setPromptId: (promptId: string) => void;
  isLatestBranch: boolean;
  enableLatestBranch: (enabled: boolean) => void;
  autoSelectTemplate: boolean;
  setAutoSelectTemplate: (enabled: boolean) => void;
  contextOptimizationEnabled: boolean;
  enableContextOptimization: (enabled: boolean) => void;

  // Tab configuration
  tabConfiguration: TabWindowConfig;
  resetTabConfiguration: () => void;
}

// Add interface to match ProviderSetting type
interface ProviderSettingWithIndex extends IProviderSetting {
  [key: string]: any;
}

export function useSettings(): UseSettingsReturn {
  const providers = useStore(providersStore);
  const debug = useStore(isDebugMode);
  const eventLogs = useStore(isEventLogsEnabled);
  const promptId = useStore(promptStore);
  const isLatestBranch = useStore(latestBranchStore);
  const autoSelectTemplate = useStore(autoSelectStarterTemplate);
  const [activeProviders, setActiveProviders] = useState<ProviderInfo[]>([]);
  const contextOptimizationEnabled = useStore(enableContextOptimizationStore);
  const tabConfiguration = useStore(tabConfigurationStore);
  const [settings, setSettings] = useState<Settings>(() => {
    const storedSettings = getLocalStorage('settings');
    return {
      theme: storedSettings?.theme || 'system',
      language: storedSettings?.language || 'en',
      notifications: storedSettings?.notifications ?? true,
      eventLogs: storedSettings?.eventLogs ?? true,
      timezone: storedSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      tabConfiguration,
    };
  });

  useEffect(() => {
    const active = Object.entries(providers)
      .filter(([_key, provider]) => provider.settings.enabled)
      .map(([_k, p]) => p);

    setActiveProviders(active);
  }, [providers]);

  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      setLocalStorage('settings', updated);

      return updated;
    });
  }, []);

  const updateProviderSettings = useCallback((provider: string, config: ProviderSettingWithIndex) => {
    updateProviderSettingsStore(provider, config);
  }, []);

  const enableDebugMode = useCallback((enabled: boolean) => {
    isDebugMode.set(enabled);
    logStore.logSystem(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    Cookies.set('isDebugEnabled', String(enabled));
  }, []);

  const setEventLogs = useCallback((enabled: boolean) => {
    updateEventLogs(enabled);
    logStore.logSystem(`Event logs ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const setPromptId = useCallback((id: string) => {
    updatePromptId(id);
    logStore.logSystem(`Prompt template updated to ${id}`);
  }, []);

  const enableLatestBranch = useCallback((enabled: boolean) => {
    updateLatestBranch(enabled);
    logStore.logSystem(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const setAutoSelectTemplate = useCallback((enabled: boolean) => {
    updateAutoSelectTemplate(enabled);
    logStore.logSystem(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const enableContextOptimization = useCallback((enabled: boolean) => {
    updateContextOptimization(enabled);
    logStore.logSystem(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
  }, []);

  const setTheme = useCallback(
    (theme: Settings['theme']) => {
      saveSettings({ theme });
    },
    [saveSettings],
  );

  const setLanguage = useCallback(
    (language: string) => {
      saveSettings({ language });
    },
    [saveSettings],
  );

  const setNotifications = useCallback(
    (enabled: boolean) => {
      saveSettings({ notifications: enabled });
    },
    [saveSettings],
  );

  const setTimezone = useCallback(
    (timezone: string) => {
      saveSettings({ timezone });
    },
    [saveSettings],
  );

  useEffect(() => {
    const providers = providersStore.get();
    const providerSetting: Record<string, IProviderSetting> = {}; // preserve the entire settings object for each provider
    Object.keys(providers).forEach((provider) => {
      providerSetting[provider] = providers[provider].settings;
    });
    Cookies.set('providers', JSON.stringify(providerSetting));
  }, [providers]);

  return {
    ...settings,
    providers,
    activeProviders,
    updateProviderSettings,
    debug,
    enableDebugMode,
    eventLogs,
    setEventLogs,
    promptId,
    setPromptId,
    isLatestBranch,
    enableLatestBranch,
    autoSelectTemplate,
    setAutoSelectTemplate,
    contextOptimizationEnabled,
    enableContextOptimization,
    setTheme,
    setLanguage,
    setNotifications,
    setTimezone,
    settings,
    tabConfiguration,
    resetTabConfiguration: resetTabConfig,
  };
}
