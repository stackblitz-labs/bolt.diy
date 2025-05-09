import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { LOCAL_PROVIDERS, URL_CONFIGURABLE_PROVIDERS } from '~/lib/stores/settings';
import type { IProviderConfig } from '~/types/model';
import { logStore } from '~/lib/stores/logs';
import { motion, AnimatePresence } from 'framer-motion';
import { BsRobot } from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { TbBrandOpenai } from 'react-icons/tb';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { useToast } from '~/components/ui/use-toast';
import OllamaModelInstaller from './OllamaModelInstaller';
import LmStudioModels from './LmStudioModels';
import { FaServer } from 'react-icons/fa';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { FiLink, FiCheck, FiX, FiEdit2, FiWifi, FiWifiOff } from 'react-icons/fi';

// Add type for provider names to ensure type safety
type ProviderName = 'Ollama' | 'LMStudio' | 'OpenAILike';

// Update the PROVIDER_ICONS type to use the ProviderName type
const PROVIDER_ICONS: Record<ProviderName, IconType> = {
  Ollama: BsRobot,
  LMStudio: BsRobot,
  OpenAILike: TbBrandOpenai,
};

// Update PROVIDER_DESCRIPTIONS to use the same type
const PROVIDER_DESCRIPTIONS: Record<ProviderName, string> = {
  Ollama: 'Run open-source models locally on your machine',
  LMStudio: 'Local model inference with LM Studio',
  OpenAILike: 'Connect to OpenAI-compatible API endpoints',
};

// Add a constant for the Ollama API base URL
const OLLAMA_API_URL = 'http://127.0.0.1:11434';

// Add connection check endpoints for each provider
const PROVIDER_CONNECTION_ENDPOINTS: Record<string, string> = {
  Ollama: '/api/tags',
  LMStudio: '/v1/models',
  OpenAILike: '/v1/models',
};

// Add connection status type
type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'unknown';

// Add interface for connection status tracking
interface ProviderConnectionStatus {
  status: ConnectionStatus;
  lastChecked: number;
  error?: string;
}

// Add type for connection status map
type ConnectionStatusMap = Record<string, ProviderConnectionStatus>;

// Add URL validation function
const validateUrlInput = (url: string): { isValid: boolean; errorMessage?: string } => {
  if (!url) {
    return { isValid: false, errorMessage: 'URL cannot be empty' };
  }

  try {
    const parsedUrl = new URL(url);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { isValid: false, errorMessage: 'URL must use http or https protocol' };
    }

    return { isValid: true };
  } catch {
    return { isValid: false, errorMessage: 'Invalid URL format' };
  }
};

export default function LocalProvidersTab() {
  const { providers, updateProviderSettings } = useSettings();
  const [filteredProviders, setFilteredProviders] = useState<IProviderConfig[]>([]);
  const [categoryEnabled, setCategoryEnabled] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState<string>('');
  const [urlInputError, setUrlInputError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusMap>({});
  const checkingConnectionsRef = useRef<boolean>(false);

  // Effect to filter and sort providers
  useEffect(() => {
    const newFilteredProviders = Object.entries(providers || {})
      .filter(([key]) => [...LOCAL_PROVIDERS].includes(key))
      .map(([key, value]) => {
        const provider = value as IProviderConfig;
        const envKey = providerBaseUrlEnvKeys[key]?.baseUrlKey;
        const envUrl = envKey ? (import.meta.env[envKey] as string | undefined) : undefined;

        // Set base URL if provided by environment
        if (envUrl && !provider.settings.baseUrl) {
          updateProviderSettings(key, {
            ...provider.settings,
            baseUrl: envUrl,
          });
        }

        return {
          name: key,
          settings: {
            ...provider.settings,
            baseUrl: provider.settings.baseUrl || envUrl,
          },
          staticModels: provider.staticModels || [],
          getDynamicModels: provider.getDynamicModels,
          getApiKeyLink: provider.getApiKeyLink,
          labelForGetApiKey: provider.labelForGetApiKey,
          icon: provider.icon,
        } as IProviderConfig;
      });

    // Custom sort function to ensure LMStudio appears before OpenAILike
    const sorted = newFilteredProviders.sort((a, b) => {
      if (a.name === 'LMStudio') {
        return -1;
      }

      if (b.name === 'LMStudio') {
        return 1;
      }

      if (a.name === 'OpenAILike') {
        return 1;
      }

      if (b.name === 'OpenAILike') {
        return -1;
      }

      return a.name.localeCompare(b.name);
    });
    setFilteredProviders(sorted);

    // Check connection status for all providers when the list changes
    checkAllProviderConnections();
  }, [providers, updateProviderSettings]);

  // Add effect to check connection status periodically for enabled providers
  useEffect(() => {
    // Check connections initially
    checkAllProviderConnections();

    // Set up interval to check connections every 30 seconds
    const intervalId = setInterval(() => {
      checkAllProviderConnections();
    }, 30000);

    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [filteredProviders]);

  // Add function to check connection for all providers
  const checkAllProviderConnections = useCallback(async () => {
    // Prevent multiple simultaneous checks
    if (checkingConnectionsRef.current) {
      return;
    }

    checkingConnectionsRef.current = true;

    try {
      // Check each enabled provider
      for (const provider of filteredProviders) {
        if (provider.settings.enabled) {
          // Set status to checking
          setConnectionStatus((prev) => ({
            ...prev,
            [provider.name]: {
              ...prev[provider.name],
              status: 'checking',
              lastChecked: Date.now(),
            },
          }));

          // Check connection
          const result = await checkProviderConnection(provider.name, provider.settings.baseUrl);

          // Update status
          setConnectionStatus((prev) => ({
            ...prev,
            [provider.name]: {
              status: result.isConnected ? 'connected' : 'disconnected',
              error: result.errorMessage,
              lastChecked: Date.now(),
            },
          }));
        }
      }
    } finally {
      checkingConnectionsRef.current = false;
    }
  }, [filteredProviders]);

  // Add general provider connection check function
  const checkProviderConnection = async (
    providerName: string,
    baseUrl?: string,
  ): Promise<{ isConnected: boolean; errorMessage?: string }> => {
    if (!baseUrl) {
      // Use default URL if none provided
      if (providerName === 'Ollama') {
        baseUrl = OLLAMA_API_URL;
      } else if (providerName === 'LMStudio') {
        baseUrl = 'http://127.0.0.1:1234'; // Default LMStudio URL
      } else {
        return { isConnected: false, errorMessage: 'No base URL configured' };
      }
    }

    // Get the appropriate endpoint for this provider
    const endpoint = PROVIDER_CONNECTION_ENDPOINTS[providerName] || '/v1/models';

    // Update connection status to checking
    setConnectionStatus((prev) => ({
      ...prev,
      [providerName]: {
        ...prev[providerName],
        status: 'checking',
        lastChecked: Date.now(),
      },
    }));

    try {
      console.log(`Checking connection to ${providerName} at ${baseUrl}${endpoint}`);

      // For LMStudio, we need to handle the connection differently due to potential CORS issues
      if (providerName === 'LMStudio') {
        // Skip direct connection in production/Cloudflare environment
        const isCloudflareEnv = typeof window !== 'undefined' && window.location.hostname !== 'localhost';

        if (!isCloudflareEnv) {
          // Only try direct connection in local development environment
          try {
            console.log(`Trying direct connection to ${providerName} at ${baseUrl}${endpoint}`);

            const response = await fetch(`${baseUrl}${endpoint}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(3000),
            });

            if (response.ok) {
              // Direct connection successful
              console.log(`Direct connection to ${providerName} successful`);
              setConnectionStatus((prev) => ({
                ...prev,
                [providerName]: {
                  status: 'connected',
                  error: undefined,
                  lastChecked: Date.now(),
                },
              }));

              return { isConnected: true };
            }
          } catch (error) {
            console.log(
              `Direct connection to ${providerName} failed, trying proxy: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );

            // Continue to proxy approach
          }
        }

        // If direct connection fails or we're in Cloudflare environment, use proxy
        try {
          // Use our server-side proxy to avoid CORS issues
          const proxyUrl = new URL('/api/proxy/lmstudio', window.location.origin);
          proxyUrl.searchParams.set('path', '/v1/models');
          proxyUrl.searchParams.set('baseUrl', baseUrl);

          console.log(`Using proxy for LMStudio: ${proxyUrl.toString()}`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for proxy

          const response = await fetch(proxyUrl.toString(), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log(`${providerName} proxy connection check response:`, response.status, response.statusText);

          if (response.ok) {
            // Try to parse the response to verify it's valid
            try {
              const responseText = await response.text();
              let data;

              try {
                data = JSON.parse(responseText);
              } catch (e) {
                console.error(`Error parsing JSON: ${e}`, responseText);
                return {
                  isConnected: false,
                  errorMessage: 'Invalid JSON response from server',
                };
              }

              if (data && typeof data === 'object') {
                console.log(`${providerName} response data:`, data);

                setConnectionStatus((prev) => ({
                  ...prev,
                  [providerName]: {
                    status: 'connected',
                    error: undefined,
                    lastChecked: Date.now(),
                  },
                }));

                return { isConnected: true };
              } else {
                const errorMessage = 'Invalid response data';
                setConnectionStatus((prev) => ({
                  ...prev,
                  [providerName]: {
                    status: 'disconnected',
                    error: errorMessage,
                    lastChecked: Date.now(),
                  },
                }));

                return {
                  isConnected: false,
                  errorMessage,
                };
              }
            } catch (error) {
              const errorMessage = `Error processing response: ${error instanceof Error ? error.message : 'Unknown error'}`;
              return {
                isConnected: false,
                errorMessage,
              };
            }
          } else {
            const errorMessage = `Connection failed: ${response.statusText} (${response.status})`;
            setConnectionStatus((prev) => ({
              ...prev,
              [providerName]: {
                status: 'disconnected',
                error: errorMessage,
                lastChecked: Date.now(),
              },
            }));

            return {
              isConnected: false,
              errorMessage,
            };
          }
        } catch (error) {
          console.error(`Connection check error for ${providerName}:`, error);

          const errorMessage =
            error instanceof Error
              ? error.name === 'AbortError'
                ? 'Connection timed out'
                : `Connection failed: ${error.message}`
              : 'Connection failed: Unknown error';

          setConnectionStatus((prev) => ({
            ...prev,
            [providerName]: {
              status: 'disconnected',
              error: errorMessage,
              lastChecked: Date.now(),
            },
          }));

          return {
            isConnected: false,
            errorMessage,
          };
        }
      } else {
        // For other providers, use the standard connection check
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Log the response status
          console.log(`${providerName} connection check response:`, response.status, response.statusText);

          if (!response.ok) {
            const errorMessage = `Connection failed: ${response.statusText} (${response.status})`;

            setConnectionStatus((prev) => ({
              ...prev,
              [providerName]: {
                status: 'disconnected',
                error: errorMessage,
                lastChecked: Date.now(),
              },
            }));

            return {
              isConnected: false,
              errorMessage,
            };
          }

          setConnectionStatus((prev) => ({
            ...prev,
            [providerName]: {
              status: 'connected',
              error: undefined,
              lastChecked: Date.now(),
            },
          }));

          return { isConnected: true };
        } catch (error) {
          clearTimeout(timeoutId);

          console.error(`Connection check error for ${providerName}:`, error);

          const errorMessage =
            error instanceof Error
              ? error.name === 'AbortError'
                ? 'Connection timed out'
                : `Connection failed: ${error.message}`
              : 'Connection failed: Unknown error';

          setConnectionStatus((prev) => ({
            ...prev,
            [providerName]: {
              status: 'disconnected',
              error: errorMessage,
              lastChecked: Date.now(),
            },
          }));

          return {
            isConnected: false,
            errorMessage,
          };
        }
      }
    } catch (error) {
      console.error(`Connection check error for ${providerName}:`, error);

      const errorMessage =
        error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed: Unknown error';

      setConnectionStatus((prev) => ({
        ...prev,
        [providerName]: {
          status: 'disconnected',
          error: errorMessage,
          lastChecked: Date.now(),
        },
      }));

      return {
        isConnected: false,
        errorMessage,
      };
    }
  };

  // Handle URL change
  const handleUrlChange = async (provider: IProviderConfig) => {
    // Validate URL format first
    const validation = validateUrlInput(urlInputValue);

    if (!validation.isValid) {
      setUrlInputError(validation.errorMessage || null);
      return;
    }

    // Check connection to the provider
    const connectionCheck = await checkProviderConnection(provider.name, urlInputValue);

    if (!connectionCheck.isConnected) {
      setUrlInputError(connectionCheck.errorMessage || null);
      return;
    }

    // Update provider settings
    updateProviderSettings(provider.name, { baseUrl: urlInputValue });

    setEditingProvider(null);
    setUrlInputValue('');

    toast(`Successfully updated ${provider.name} base URL to ${urlInputValue}`);

    // Check connection status after URL change
    checkProviderConnection(provider.name, urlInputValue);
  };

  // Add a component to display connection status
  const ConnectionStatusIndicator = ({ providerName }: { providerName: string }) => {
    const status = connectionStatus[providerName] || { status: 'unknown', lastChecked: 0 };

    return (
      <div
        className="flex items-center gap-1"
        title={`Status: ${status.status}${status.error ? ` - ${status.error}` : ''}`}
      >
        {status.status === 'connected' && <FiWifi className="text-green-500 dark:text-green-400" />}
        {status.status === 'disconnected' && <FiWifiOff className="text-red-500 dark:text-red-400" />}
        {status.status === 'checking' && (
          <div className="i-ph:spinner-gap-bold animate-spin text-bolt-elements-button-primary-text" />
        )}
        {status.status === 'unknown' && <FiWifi className="text-bolt-elements-textSecondary" />}
      </div>
    );
  };

  // Add effect to update category toggle state based on provider states
  useEffect(() => {
    const newCategoryState = filteredProviders.every((p) => p.settings.enabled);
    setCategoryEnabled(newCategoryState);
  }, [filteredProviders]);

  const handleToggleCategory = useCallback(
    async (enabled: boolean) => {
      filteredProviders.forEach((provider) => {
        updateProviderSettings(provider.name, { ...provider.settings, enabled });
      });
      toast(enabled ? 'All local providers enabled' : 'All local providers disabled');
    },
    [filteredProviders, updateProviderSettings],
  );

  const handleToggleProvider = (provider: IProviderConfig, enabled: boolean) => {
    updateProviderSettings(provider.name, {
      ...provider.settings,
      enabled,
    });

    if (enabled) {
      logStore.logProvider(`Provider ${provider.name} enabled`, { provider: provider.name });
      toast(`${provider.name} enabled`);
    } else {
      logStore.logProvider(`Provider ${provider.name} disabled`, { provider: provider.name });
      toast(`${provider.name} disabled`);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary min-h-screen">
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-bolt-elements-background-depth-2 rounded-lg">
              <FaServer className="text-bolt-elements-textPrimary text-xl" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium">Local Providers</h2>
                <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                  Local
                </span>
              </div>
              <p className="text-sm text-bolt-elements-textSecondary">Configure and manage local LLM providers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-bolt-elements-textSecondary">Enable All</span>
            <Switch
              checked={categoryEnabled}
              onCheckedChange={filteredProviders.length > 0 ? handleToggleCategory : undefined}
            />
          </div>
        </div>

        {/* Ollama Section */}
        {filteredProviders
          .filter((provider) => provider.name === 'Ollama')
          .map((provider) => (
            <motion.div
              key={provider.name}
              className="flex flex-col gap-4 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Provider Header */}
              <div className="flex items-center justify-between bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${provider.settings.enabled ? 'bg-bolt-elements-button-primary-background' : 'bg-bolt-elements-background-depth-3'}`}
                  >
                    {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                      className: `w-6 h-6 ${provider.settings.enabled ? 'text-bolt-elements-button-primary-text' : 'text-bolt-elements-textPrimary'}`,
                      'aria-label': `${provider.name} icon`,
                    })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{provider.name}</h3>
                      <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                        Local
                      </span>
                      {provider.settings.enabled && (
                        <div className="flex items-center" title={`Status: ${connectionStatus[provider.name]?.status}`}>
                          {connectionStatus[provider.name]?.status === 'connected' && (
                            <FiWifi className="text-green-500 dark:text-green-400" />
                          )}
                          {connectionStatus[provider.name]?.status === 'disconnected' && (
                            <FiWifiOff className="text-red-500 dark:text-red-400" />
                          )}
                          {connectionStatus[provider.name]?.status === 'checking' && (
                            <div className="i-ph:spinner-gap-bold animate-spin text-bolt-elements-button-primary-text" />
                          )}
                          {(!connectionStatus[provider.name] ||
                            connectionStatus[provider.name]?.status === 'unknown') && (
                            <FiWifi className="text-bolt-elements-textSecondary" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-bolt-elements-textSecondary">
                      {PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={provider.settings.enabled}
                  onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                  aria-label={`Toggle ${provider.name} provider`}
                />
              </div>

              {/* Ollama Model Installer */}
              {provider.settings.enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-col gap-4"
                >
                  {/* URL Configuration Section */}
                  <div className="flex flex-col gap-2 bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor">
                    <label className="text-sm font-medium">API Endpoint</label>
                    {urlInputError && editingProvider === provider.name && (
                      <span className="text-sm text-bolt-elements-button-danger-text">{urlInputError}</span>
                    )}

                    {editingProvider === provider.name ? (
                      <div className="relative">
                        <Input
                          ref={urlInputRef}
                          type="text"
                          value={urlInputValue}
                          onChange={(e) => {
                            setUrlInputValue(e.target.value);
                            setUrlInputError(null); // Clear error on change
                          }}
                          placeholder="Enter Ollama base URL"
                          className="flex-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border-bolt-elements-borderColor"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUrlChange(provider);
                            } else if (e.key === 'Escape') {
                              setEditingProvider(null);
                              setUrlInputError(null);
                            }
                          }}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUrlChange(provider)}
                            className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                            aria-label="Confirm URL change"
                          >
                            <FiCheck className="text-bolt-elements-button-primary-text" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingProvider(null)}
                            className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-danger-backgroundHover"
                            aria-label="Cancel URL change"
                          >
                            <FiX className="text-bolt-elements-button-danger-text" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingProvider(provider.name);
                          setUrlInputValue(provider.settings.baseUrl || OLLAMA_API_URL);
                        }}
                        className="relative cursor-pointer group"
                      >
                        <div className="flex items-center bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md px-3 py-2 hover:border-bolt-elements-borderColorActive transition-colors">
                          <FiLink className="text-bolt-elements-textPrimary mr-2" />
                          <span className="flex-1 text-bolt-elements-textPrimary">
                            {provider.settings.baseUrl || OLLAMA_API_URL}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                checkProviderConnection(provider.name, provider.settings.baseUrl).then((result) => {
                                  setConnectionStatus((prev) => ({
                                    ...prev,
                                    [provider.name]: {
                                      status: result.isConnected ? 'connected' : 'disconnected',
                                      error: result.errorMessage,
                                      lastChecked: Date.now(),
                                    },
                                  }));

                                  if (result.isConnected) {
                                    toast(`Successfully connected to ${provider.name}`);
                                  } else {
                                    toast(`Failed to connect to ${provider.name}: ${result.errorMessage}`, {
                                      type: 'error',
                                    });
                                  }
                                });
                              }}
                              className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                              aria-label="Check connection"
                            >
                              <span className="i-ph:arrows-clockwise text-bolt-elements-textPrimary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProvider(provider.name);
                                setUrlInputValue(provider.settings.baseUrl || OLLAMA_API_URL);
                              }}
                              className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                              aria-label="Edit URL"
                            >
                              <FiEdit2 className="text-bolt-elements-textPrimary" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-bolt-elements-textSecondary mt-1">
                      The API endpoint should point to your {provider.name} server
                    </p>
                  </div>

                  {/* Installed Models Section */}
                  <div className="mt-4">
                    {connectionStatus[provider.name]?.status === 'connected' ? (
                      <OllamaModelInstaller
                        onModelInstalled={() => {
                          /*
                           * Force a complete refresh of the provider connection
                           * This will update the model list in the selector
                           */
                          console.log('Model installed/deleted, refreshing provider connection');

                          // Immediate refresh
                          checkProviderConnection(provider.name, provider.settings.baseUrl);

                          /*
                           * Multiple refresh attempts with increasing delays
                           * This helps ensure the model is detected even if Ollama is slow to register it
                           */
                          const refreshAttempts = [500, 1500, 3000, 5000];

                          refreshAttempts.forEach((delay) => {
                            setTimeout(() => {
                              console.log(`Refresh attempt after ${delay}ms`);
                              checkProviderConnection(provider.name, provider.settings.baseUrl);

                              // Also do a full refresh of all providers
                              if (delay > 1000) {
                                checkAllProviderConnections();
                              }
                            }, delay);
                          });
                        }}
                        baseUrl={provider.settings.baseUrl || OLLAMA_API_URL}
                        isConnected={connectionStatus[provider.name]?.status === 'connected'}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-8 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
                        <div className="i-ph:cube-transparent w-12 h-12 text-bolt-elements-textPrimary" />
                        <p className="text-lg font-medium">No connection to Ollama server</p>
                        <p className="text-sm text-bolt-elements-textSecondary">
                          Check your connection settings and try again
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => checkProviderConnection(provider.name, provider.settings.baseUrl)}
                          className="mt-2"
                        >
                          <span className="i-ph:arrows-clockwise mr-2 text-bolt-elements-textPrimary" />
                          Check Connection
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}

        {/* Other Providers Section */}
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Other Local Providers</h3>

          {/* LMStudio Provider */}
          <div className="flex flex-wrap gap-4">
            {filteredProviders
              .filter((provider) => provider.name === 'LMStudio')
              .map((provider, index) => (
                <motion.div
                  key={provider.name}
                  className="bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors flex-1 w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Provider Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${provider.settings.enabled ? 'bg-bolt-elements-button-primary-background' : 'bg-bolt-elements-background-depth-3'}`}
                      >
                        {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                          className: `w-6 h-6 ${provider.settings.enabled ? 'text-bolt-elements-button-primary-text' : 'text-bolt-elements-textPrimary'}`,
                          'aria-label': `${provider.name} icon`,
                        })}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{provider.name}</h3>
                          <div className="flex gap-1">
                            <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                              Local
                            </span>
                            {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                              <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                                Configurable
                              </span>
                            )}
                          </div>
                          {provider.settings.enabled && <ConnectionStatusIndicator providerName={provider.name} />}
                        </div>
                        <p className="text-sm text-bolt-elements-textSecondary mt-1">
                          {PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={provider.settings.enabled}
                      onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                      aria-label={`Toggle ${provider.name} provider`}
                    />
                  </div>

                  {/* URL Configuration Section */}
                  <AnimatePresence>
                    {provider.settings.enabled && URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                      >
                        <div className="flex flex-col gap-2 bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor">
                          <label className="text-sm font-medium">API Endpoint</label>
                          {urlInputError && editingProvider === provider.name && (
                            <span className="text-sm text-bolt-elements-button-danger-text">{urlInputError}</span>
                          )}

                          {editingProvider === provider.name ? (
                            <div className="relative">
                              <Input
                                ref={urlInputRef}
                                type="text"
                                value={urlInputValue}
                                onChange={(e) => {
                                  setUrlInputValue(e.target.value);
                                  setUrlInputError(null); // Clear error on change
                                }}
                                placeholder={`Enter ${provider.name} base URL`}
                                className="flex-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border-bolt-elements-borderColor"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUrlChange(provider);
                                  } else if (e.key === 'Escape') {
                                    setEditingProvider(null);
                                    setUrlInputError(null);
                                  }
                                }}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleUrlChange(provider)}
                                  className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                  aria-label="Confirm URL change"
                                >
                                  <FiCheck className="text-bolt-elements-button-primary-text" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingProvider(null)}
                                  className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-danger-backgroundHover"
                                  aria-label="Cancel URL change"
                                >
                                  <FiX className="text-bolt-elements-button-danger-text" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingProvider(provider.name);
                                setUrlInputValue(provider.settings.baseUrl || '');
                              }}
                              className="relative cursor-pointer group"
                            >
                              <div className="flex items-center bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md px-3 py-2 hover:border-bolt-elements-borderColorActive transition-colors">
                                <FiLink className="text-bolt-elements-textPrimary mr-2" />
                                <span className="flex-1 text-bolt-elements-textPrimary">
                                  {provider.settings.baseUrl || 'No URL configured'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkProviderConnection(provider.name, provider.settings.baseUrl).then(
                                        (result) => {
                                          setConnectionStatus((prev) => ({
                                            ...prev,
                                            [provider.name]: {
                                              status: result.isConnected ? 'connected' : 'disconnected',
                                              error: result.errorMessage,
                                              lastChecked: Date.now(),
                                            },
                                          }));

                                          if (result.isConnected) {
                                            toast(`Successfully connected to ${provider.name}`);
                                          } else {
                                            toast(`Failed to connect to ${provider.name}: ${result.errorMessage}`, {
                                              type: 'error',
                                            });
                                          }
                                        },
                                      );
                                    }}
                                    className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                    aria-label="Check connection"
                                  >
                                    <span className="i-ph:arrows-clockwise text-bolt-elements-textPrimary" />
                                  </Button>
                                  {provider.name === 'LMStudio' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        // Test the proxy connection directly
                                        const proxyUrl = new URL('/api/proxy/lmstudio', window.location.origin);
                                        proxyUrl.searchParams.set('path', '/v1/models');
                                        proxyUrl.searchParams.set(
                                          'baseUrl',
                                          provider.settings.baseUrl || 'http://127.0.0.1:1234',
                                        );

                                        toast(`Testing proxy connection to ${provider.name}...`);

                                        fetch(proxyUrl.toString(), {
                                          method: 'GET',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                        })
                                          .then((response) => {
                                            if (response.ok) {
                                              return response.json().then((data: any) => {
                                                toast(
                                                  `Proxy connection successful! Found ${
                                                    Array.isArray(data.data) ? data.data.length : 0
                                                  } models.`,
                                                );
                                                setConnectionStatus((prev) => ({
                                                  ...prev,
                                                  [provider.name]: {
                                                    status: 'connected',
                                                    error: undefined,
                                                    lastChecked: Date.now(),
                                                  },
                                                }));
                                              });
                                            } else {
                                              return response.text().then((text) => {
                                                throw new Error(`Status ${response.status}: ${text}`);
                                              });
                                            }
                                          })
                                          .catch((error) => {
                                            toast(`Proxy connection failed: ${error.message}`, { type: 'error' });
                                            setConnectionStatus((prev) => ({
                                              ...prev,
                                              [provider.name]: {
                                                status: 'disconnected',
                                                error: error.message,
                                                lastChecked: Date.now(),
                                              },
                                            }));
                                          });
                                      }}
                                      className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                      aria-label="Test proxy connection"
                                      title="Test proxy connection (bypasses CORS)"
                                    >
                                      <span className="i-ph:globe-simple text-bolt-elements-textPrimary" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingProvider(provider.name);
                                      setUrlInputValue(provider.settings.baseUrl || '');
                                    }}
                                    className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                    aria-label="Edit URL"
                                  >
                                    <FiEdit2 className="text-bolt-elements-textPrimary" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-bolt-elements-textSecondary mt-1">
                            The API endpoint should point to your {provider.name} server
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* LM Studio Model List */}
                  {provider.name === 'LMStudio' &&
                    provider.settings.enabled &&
                    connectionStatus[provider.name]?.status === 'connected' && (
                      <div className="mt-6">
                        <LmStudioModels
                          baseUrl={provider.settings.baseUrl || 'http://127.0.0.1:1234'}
                          isConnected={connectionStatus[provider.name]?.status === 'connected'}
                        />
                      </div>
                    )}
                </motion.div>
              ))}
          </div>

          {/* OpenAILike Provider */}
          <div className="flex flex-wrap gap-4 mt-4">
            {filteredProviders
              .filter((provider) => provider.name === 'OpenAILike')
              .map((provider, index) => (
                <motion.div
                  key={provider.name}
                  className="bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors flex-1 w-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {/* Provider Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${provider.settings.enabled ? 'bg-bolt-elements-button-primary-background' : 'bg-bolt-elements-background-depth-3'}`}
                      >
                        {React.createElement(PROVIDER_ICONS[provider.name as ProviderName] || BsRobot, {
                          className: `w-6 h-6 ${provider.settings.enabled ? 'text-bolt-elements-button-primary-text' : 'text-bolt-elements-textPrimary'}`,
                          'aria-label': `${provider.name} icon`,
                        })}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{provider.name}</h3>
                          <div className="flex gap-1">
                            <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                              Local
                            </span>
                            {URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                              <span className="text-xs px-2 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-full">
                                Configurable
                              </span>
                            )}
                          </div>
                          {provider.settings.enabled && <ConnectionStatusIndicator providerName={provider.name} />}
                        </div>
                        <p className="text-sm text-bolt-elements-textSecondary mt-1">
                          {PROVIDER_DESCRIPTIONS[provider.name as ProviderName]}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={provider.settings.enabled}
                      onCheckedChange={(checked) => handleToggleProvider(provider, checked)}
                      aria-label={`Toggle ${provider.name} provider`}
                    />
                  </div>

                  {/* URL Configuration Section */}
                  <AnimatePresence>
                    {provider.settings.enabled && URL_CONFIGURABLE_PROVIDERS.includes(provider.name) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                      >
                        <div className="flex flex-col gap-2 bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor">
                          <label className="text-sm font-medium">API Endpoint</label>
                          {urlInputError && editingProvider === provider.name && (
                            <span className="text-sm text-bolt-elements-button-danger-text">{urlInputError}</span>
                          )}

                          {editingProvider === provider.name ? (
                            <div className="relative">
                              <Input
                                ref={urlInputRef}
                                type="text"
                                value={urlInputValue}
                                onChange={(e) => {
                                  setUrlInputValue(e.target.value);
                                  setUrlInputError(null); // Clear error on change
                                }}
                                placeholder={`Enter ${provider.name} base URL`}
                                className="flex-1 bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border-bolt-elements-borderColor"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUrlChange(provider);
                                  } else if (e.key === 'Escape') {
                                    setEditingProvider(null);
                                    setUrlInputError(null);
                                  }
                                }}
                              />
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleUrlChange(provider)}
                                  className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                  aria-label="Confirm URL change"
                                >
                                  <FiCheck className="text-bolt-elements-button-primary-text" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingProvider(null)}
                                  className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-danger-backgroundHover"
                                  aria-label="Cancel URL change"
                                >
                                  <FiX className="text-bolt-elements-button-danger-text" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingProvider(provider.name);
                                setUrlInputValue(provider.settings.baseUrl || '');
                              }}
                              className="relative cursor-pointer group"
                            >
                              <div className="flex items-center bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md px-3 py-2 hover:border-bolt-elements-borderColorActive transition-colors">
                                <FiLink className="text-bolt-elements-textPrimary mr-2" />
                                <span className="flex-1 text-bolt-elements-textPrimary">
                                  {provider.settings.baseUrl || 'No URL configured'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      checkProviderConnection(provider.name, provider.settings.baseUrl).then(
                                        (result) => {
                                          setConnectionStatus((prev) => ({
                                            ...prev,
                                            [provider.name]: {
                                              status: result.isConnected ? 'connected' : 'disconnected',
                                              error: result.errorMessage,
                                              lastChecked: Date.now(),
                                            },
                                          }));

                                          if (result.isConnected) {
                                            toast(`Successfully connected to ${provider.name}`);
                                          } else {
                                            toast(`Failed to connect to ${provider.name}: ${result.errorMessage}`, {
                                              type: 'error',
                                            });
                                          }
                                        },
                                      );
                                    }}
                                    className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                    aria-label="Check connection"
                                  >
                                    <span className="i-ph:arrows-clockwise text-bolt-elements-textPrimary" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingProvider(provider.name);
                                      setUrlInputValue(provider.settings.baseUrl || '');
                                    }}
                                    className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
                                    aria-label="Edit URL"
                                  >
                                    <FiEdit2 className="text-bolt-elements-textPrimary" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          <p className="text-xs text-bolt-elements-textSecondary mt-1">
                            The API endpoint should point to your {provider.name} server
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
