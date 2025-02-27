import React from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Switch } from '~/components/ui/Switch';
import { useProviderSettings } from '~/components/@settings/tabs/providers/local/common/hooks';
import type { ProviderSettings } from '~/components/@settings/tabs/providers/local/common/types';
import { LMStudioApiClient } from './api';
import { useServerStatus } from '~/components/@settings/tabs/providers/local/common/hooks';
import { useModelList } from '~/components/@settings/tabs/providers/local/common/hooks';
import { motion } from 'framer-motion';
import { BsRobot } from 'react-icons/bs';
import { cn } from '~/utils/classNames';
import type { ModelInfo } from '~/components/@settings/tabs/providers/local/common/types';

interface LmStudioProviderProps {
  onSettingsChange?: (settings: ProviderSettings) => void;
}

export default function LmStudioProvider({ onSettingsChange: _onSettingsChange }: LmStudioProviderProps) {
  const { settings, updateSettings } = useProviderSettings('LMStudio');
  const [apiClient, setApiClient] = React.useState<LMStudioApiClient | null>(null);
  const [isUrlEditing, setIsUrlEditing] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState(settings?.baseUrl || 'http://localhost:1234');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoadingModels, setIsLoadingModels] = React.useState(false);
  const [models, setModels] = React.useState<ModelInfo[]>([]);

  // Initialize API client when settings change
  React.useEffect(() => {
    if (settings?.baseUrl) {
      console.log('Initializing LM Studio API client with base URL:', settings.baseUrl);
      setApiClient(new LMStudioApiClient(settings.baseUrl, settings.apiKey));
    }
  }, [settings?.baseUrl, settings?.apiKey]);

  // Check server status and fetch models
  const { isRunning, isChecking } = useServerStatus(
    async () => {
      if (!apiClient) {
        console.log('No LM Studio API client available');
        return false;
      }

      console.log('Checking LM Studio server status...');

      const result = await apiClient.isServerRunning();
      console.log('LM Studio server running:', result);

      return result;
    },
    settings.enabled,
    [apiClient, settings.enabled],
  );

  // Use the useModelList hook for better performance
  const {
    models: hookModels,
    isLoading: hookIsLoadingModels,
    error: hookModelsError,
    refreshModels,
  } = useModelList('LMStudio', apiClient, isRunning);

  // Sync the hook's state with our local state
  React.useEffect(() => {
    if (hookModels && hookModels.length > 0) {
      console.log('Setting models from hook:', hookModels);
      setModels(hookModels);
    }

    setIsLoadingModels(hookIsLoadingModels);

    if (hookModelsError) {
      console.error('LM Studio models error from hook:', hookModelsError);
      setError(hookModelsError);
    }
  }, [hookModels, hookIsLoadingModels, hookModelsError]);

  // Set error if no models found, but only if we're connected to the server
  React.useEffect(() => {
    if (isRunning && !isLoadingModels && models.length === 0 && !error) {
      console.log('Server is running but no models found, setting error');
      setError('No models found in LM Studio');
    } else if (isRunning && models.length > 0 && error === 'No models found in LM Studio') {
      // Clear the "no models" error if we now have models
      console.log('Models found, clearing error');
      setError(null);
    }
  }, [models, isLoadingModels, error, isRunning]);

  // Manually refresh models when server status changes
  React.useEffect(() => {
    if (isRunning && !isLoadingModels) {
      console.log('Server is running, refreshing models...');

      // Only refresh if we don't already have models
      if (models.length === 0) {
        refreshModels();
      }
    }
  }, [isRunning, refreshModels, isLoadingModels, models.length]);

  const handleToggle = (enabled: boolean) => {
    updateSettings({ enabled });
  };

  const handleUrlChange = () => {
    if (urlInput && urlInput !== settings.baseUrl) {
      updateSettings({ baseUrl: urlInput });
    }

    setIsUrlEditing(false);
  };

  const startUrlEditing = () => {
    setUrlInput(settings.baseUrl || 'http://localhost:1234');
    setIsUrlEditing(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-bolt-elements-background-depth-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BsRobot className="text-blue-500 text-xl" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">LM Studio</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Run and fine-tune models with a user-friendly interface
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settings.enabled && (
            <div
              className={cn(
                'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full',
                isChecking
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : isRunning && models.length > 0
                    ? 'bg-green-500/10 text-green-500'
                    : isRunning && models.length === 0
                      ? 'bg-yellow-500/10 text-yellow-500'
                      : 'bg-red-500/10 text-red-500',
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isChecking
                    ? 'bg-yellow-500 animate-pulse'
                    : isRunning && models.length > 0
                      ? 'bg-green-500'
                      : isRunning && models.length === 0
                        ? 'bg-yellow-500'
                        : 'bg-red-500',
                )}
              />
              {isChecking
                ? 'Checking...'
                : isRunning && models.length > 0
                  ? 'Connected to LM Studio'
                  : isRunning && models.length === 0
                    ? 'Connected, no models'
                    : 'Server offline'}
            </div>
          )}
          <Switch checked={settings.enabled} onCheckedChange={handleToggle} />
        </div>
      </div>

      {settings.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-4 p-4 rounded-xl bg-bolt-elements-background-depth-2"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-bolt-elements-textSecondary">Server URL</label>
            {isUrlEditing ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                  placeholder="http://localhost:1234"
                />
                <Button onClick={handleUrlChange}>Save</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUrlInput(settings.baseUrl || 'http://localhost:1234');
                    setIsUrlEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                onClick={startUrlEditing}
                className={cn(
                  'px-3 py-2 rounded-lg cursor-pointer',
                  'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4',
                  'flex items-center justify-between',
                )}
              >
                <span className="text-bolt-elements-textPrimary">{settings.baseUrl}</span>
                <span className="text-xs text-bolt-elements-textSecondary">Click to edit</span>
              </div>
            )}
          </div>

          {/* Connection status and refresh button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-3 h-3 rounded-full',
                  isChecking ? 'bg-yellow-500 animate-pulse' : isRunning ? 'bg-green-500' : 'bg-red-500',
                )}
              />
              <span className="text-sm text-bolt-elements-textSecondary">
                {isChecking ? 'Checking connection...' : isRunning ? 'Connected to LM Studio' : 'Not connected'}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    console.log('Checking if LM Studio server is accessible...');

                    const baseUrl = settings.baseUrl || 'http://localhost:1234';

                    // Try direct connection first (will likely fail due to CORS)
                    try {
                      console.log('Trying direct connection to LM Studio at:', baseUrl);

                      const directResponse = await fetch(`${baseUrl}/v1/models`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      });
                      console.log('Direct connection response:', directResponse.status);

                      if (directResponse.ok) {
                        console.log('LM Studio server is accessible directly');

                        const data = await directResponse.json();
                        console.log('Direct connection data:', data);
                      }
                    } catch (directErr) {
                      console.error('Direct connection failed (expected due to CORS):', directErr);
                    }

                    // Now try with the proxy
                    console.log('Trying proxy connection to LM Studio...');

                    const proxyUrl = `/api/proxy/lmstudio?url=${encodeURIComponent(`${baseUrl}/v1/models`)}`;
                    console.log('Proxy URL:', proxyUrl);

                    const proxyResponse = await fetch(proxyUrl);
                    console.log('Proxy connection response:', proxyResponse.status);

                    if (proxyResponse.ok) {
                      console.log('LM Studio server is accessible via proxy');

                      const data = await proxyResponse.json();
                      console.log('Proxy connection data:', data);
                    } else {
                      console.error('Proxy connection failed:', proxyResponse.status);

                      const errorText = await proxyResponse.text();
                      console.error('Proxy error:', errorText);
                    }
                  } catch (err) {
                    console.error('Error checking LM Studio server:', err);
                  }
                }}
                disabled={isChecking}
              >
                Check LM Studio
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!apiClient) {
                    return;
                  }

                  setIsLoadingModels(true);
                  setError(null);

                  try {
                    console.log('Manually fetching models via proxy...');

                    const proxyModels = await apiClient.getModelsViaProxy();
                    console.log('Manual proxy fetch result:', proxyModels);

                    if (proxyModels && proxyModels.length > 0) {
                      setModels(proxyModels);
                      console.log('Models updated from manual proxy fetch');
                    } else {
                      setError('No models found via proxy');
                    }
                  } catch (err) {
                    console.error('Manual proxy fetch error:', err);
                    setError(err instanceof Error ? err.message : 'Failed to fetch models via proxy');
                  } finally {
                    setIsLoadingModels(false);
                  }
                }}
                disabled={isChecking || isLoadingModels}
              >
                Try Proxy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!apiClient) {
                    return;
                  }

                  try {
                    console.log('Directly testing LM Studio server...');

                    const baseUrl = settings.baseUrl || 'http://localhost:1234';

                    try {
                      // First try with fetch directly (will likely fail due to CORS)
                      console.log('Testing direct fetch to LM Studio...');

                      const directResponse = await fetch(`${baseUrl}/v1/models`, {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      });
                      console.log('Direct fetch response:', directResponse.status);
                    } catch (directErr) {
                      console.error('Direct fetch failed (expected):', directErr);
                    }

                    // Now try with the proxy
                    console.log('Testing proxy fetch to LM Studio...');

                    const proxyResponse = await fetch(
                      `/api/proxy/lmstudio?url=${encodeURIComponent(`${baseUrl}/v1/models`)}`,
                      {
                        method: 'GET',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                      },
                    );

                    console.log('Proxy response status:', proxyResponse.status);

                    if (proxyResponse.ok) {
                      const data = await proxyResponse.json();
                      console.log('Proxy response data:', data);

                      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
                        console.log('Found models via proxy:', data.data.length);

                        const mappedModels: ModelInfo[] = data.data.map((model: any) => ({
                          name: model.id,
                          desc: model.owned_by ? `Provided by ${model.owned_by}` : 'Local model hosted by LM Studio',
                          installed: true,
                        }));

                        console.log('Mapped models:', mappedModels);
                        setModels(mappedModels);
                      } else {
                        console.error('Invalid response format from proxy:', data);
                        setError('Invalid response format from LM Studio server');
                      }
                    }
                  } catch (err) {
                    console.error('Error testing LM Studio server:', err);
                  }
                }}
                disabled={isChecking}
              >
                Test Server
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  refreshModels();
                }}
                disabled={isChecking}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Error message */}
          {error && !isRunning && (
            <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
              <p className="font-medium">Connection Error</p>
              <p>{error}</p>
              <p className="mt-2 text-xs">
                Make sure LM Studio is running and the server is enabled in LM Studio settings.
              </p>
            </div>
          )}

          {error && isRunning && models.length === 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 text-sm">
              <p className="font-medium">No Models Found</p>
              <p>{error}</p>
              <p className="mt-2 text-xs">
                LM Studio server is running, but no models were found. Make sure you have models loaded in LM Studio.
              </p>
            </div>
          )}

          {/* Models */}
          {isRunning && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-bolt-elements-textSecondary">Available Models</label>
              {/* Log model state for debugging outside of JSX */}
              {(() => {
                console.log(
                  'LMStudioProvider rendering models section, isLoadingModels:',
                  isLoadingModels,
                  'models:',
                  models,
                );
                return null; // Return null so nothing is rendered
              })()}
              {isLoadingModels ? (
                <div className="text-sm text-bolt-elements-textSecondary">Loading models...</div>
              ) : models.length > 0 ? (
                <div className="space-y-2">
                  {models.map((model) => (
                    <div
                      key={model.name}
                      className="flex items-center justify-between p-2 rounded-md bg-bolt-elements-bgSecondary"
                    >
                      <div>
                        <div className="font-medium">{model.name}</div>
                        {model.desc && <div className="text-sm text-bolt-elements-textSecondary">{model.desc}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-bolt-elements-textSecondary">No models found</div>
              )}
            </div>
          )}

          <div className="text-sm text-bolt-elements-textSecondary">
            <p>Connect to LM Studio for local model inference.</p>
            <p className="mt-2">
              <a
                href="https://lmstudio.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Download LM Studio
              </a>
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
