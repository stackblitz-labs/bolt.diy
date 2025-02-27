import React from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Switch } from '~/components/ui/Switch';
import { useProviderSettings } from '~/components/@settings/tabs/providers/local/common/hooks';
import type { ProviderSettings } from '~/components/@settings/tabs/providers/local/common/types';
import { OllamaApiClient } from './api';
import { useServerStatus } from '~/components/@settings/tabs/providers/local/common/hooks';
import { useModelList } from '~/components/@settings/tabs/providers/local/common/hooks'; // Import the new hook
import { motion } from 'framer-motion';
import { BsRobot } from 'react-icons/bs';
import { cn } from '~/utils/classNames';
import OllamaModelInstaller from '~/components/@settings/tabs/providers/local/OllamaModelInstaller';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';

interface OllamaProviderProps {
  onSettingsChange?: (settings: ProviderSettings) => void;
}

export default function OllamaProvider({ onSettingsChange: _onSettingsChange }: OllamaProviderProps) {
  const { settings, updateSettings } = useProviderSettings('Ollama');
  const [apiClient, setApiClient] = React.useState<OllamaApiClient | null>(null);
  const [isUrlEditing, setIsUrlEditing] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState(settings?.baseUrl || 'http://localhost:11434');
  const [error, setError] = React.useState<string | null>(null);
  const [modelProgress, setModelProgress] = React.useState<Record<string, number>>({});
  const [showModelInstaller, setShowModelInstaller] = React.useState(false);

  // Initialize API client when settings change
  React.useEffect(() => {
    if (settings?.baseUrl) {
      const client = new OllamaApiClient(settings.baseUrl);
      setApiClient(client);
    }
  }, [settings?.baseUrl]);

  // Check server status and fetch models
  const { isRunning, isChecking } = useServerStatus(
    async () => {
      if (!apiClient) {
        return false;
      }

      return apiClient.isServerRunning();
    },
    settings.enabled,
    [apiClient, settings.enabled],
  );

  // Use the new useModelList hook for better performance
  const {
    models,
    isLoading: isLoadingModels,
    error: modelsError,
    refreshModels,
  } = useModelList('Ollama', apiClient, isRunning);

  // Set error from models error if present
  React.useEffect(() => {
    if (modelsError) {
      setError(modelsError);
    }
  }, [modelsError]);

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
    setUrlInput(settings.baseUrl || 'http://localhost:11434');
    setIsUrlEditing(true);
  };

  const handlePullModel = async (modelName: string) => {
    if (!apiClient) {
      return;
    }

    try {
      setModelProgress((prev) => ({ ...prev, [modelName]: 0 }));
      await apiClient.pullModel(modelName, (progress) => {
        setModelProgress((prev) => ({ ...prev, [modelName]: progress }));
      });
      setModelProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[modelName];

        return newProgress;
      });

      // Refresh models after pull
      refreshModels();
    } catch (err) {
      console.error('Error pulling model:', err);
      setError(err instanceof Error ? err.message : 'Failed to pull model');
      setModelProgress((prev) => {
        const newProgress = { ...prev };
        delete newProgress[modelName];

        return newProgress;
      });
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!apiClient) {
      return;
    }

    try {
      await apiClient.deleteModel(modelName);

      // Refresh models after delete
      refreshModels();
    } catch (err) {
      console.error('Error deleting model:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-bolt-elements-background-depth-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BsRobot className="text-blue-500 text-xl" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">Ollama</h3>
            <p className="text-sm text-bolt-elements-textSecondary">Run open-source models locally with Ollama</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {settings.enabled && (
            <div
              className={cn(
                'px-2 py-1 rounded-lg text-xs flex items-center gap-1',
                isChecking
                  ? 'bg-yellow-500/10 text-yellow-500'
                  : isRunning
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500',
              )}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full',
                  isChecking ? 'bg-yellow-500 animate-pulse' : isRunning ? 'bg-green-500' : 'bg-red-500',
                )}
              />
              {isChecking ? 'Checking...' : isRunning ? 'Server running' : 'Server offline'}
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
                  placeholder="http://localhost:11434"
                />
                <Button onClick={handleUrlChange}>Save</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUrlInput(settings.baseUrl || 'http://localhost:11434');
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
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-background-depth-4',
                  'transition-colors',
                )}
              >
                {settings.baseUrl || 'Click to set server URL'}
              </div>
            )}
          </div>

          {/* Models */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-bolt-elements-textSecondary">Available Models</label>
                <Button size="sm" onClick={() => setShowModelInstaller(true)} className="text-sm">
                  Advanced Model Installer
                </Button>
              </div>
              {error ? (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                  {error}
                </div>
              ) : isLoadingModels ? (
                <div className="text-sm text-bolt-elements-textSecondary">Loading models...</div>
              ) : models.length > 0 ? (
                <div className="space-y-2">
                  {models.map((model) => (
                    <div
                      key={model.name}
                      className="p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-bolt-elements-textPrimary">{model.name}</div>
                          {model.desc && <div className="text-sm text-bolt-elements-textSecondary">{model.desc}</div>}
                          {model.size && (
                            <div className="text-xs text-bolt-elements-textSecondary">Size: {model.size}</div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {modelProgress[model.name] !== undefined ? (
                            <div className="text-sm text-bolt-elements-textSecondary">
                              Pulling... {Math.round(modelProgress[model.name])}%
                            </div>
                          ) : model.installed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteModel(model.name)}
                              className="text-red-500 hover:text-red-600"
                            >
                              Delete
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => handlePullModel(model.name)}>
                              Pull
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-bolt-elements-textSecondary">No models available</div>
              )}
            </div>
          )}

          <div className="text-sm text-bolt-elements-textSecondary">
            <p>Run open-source models locally with Ollama.</p>
            <p className="mt-2">
              <a
                href="https://ollama.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Download Ollama
              </a>
            </p>
          </div>
        </motion.div>
      )}

      {/* Model Installer Dialog */}
      <DialogRoot open={showModelInstaller} onOpenChange={setShowModelInstaller}>
        <Dialog className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <OllamaModelInstaller
            onModelInstalled={() => {
              setShowModelInstaller(false);
              refreshModels();
            }}
          />
        </Dialog>
      </DialogRoot>
    </div>
  );
}
