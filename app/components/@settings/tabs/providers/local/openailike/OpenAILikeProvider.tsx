import React from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Switch } from '~/components/ui/Switch';
import { useProviderSettings } from '~/components/@settings/tabs/providers/local/common/hooks';
import type { ProviderSettings } from '~/components/@settings/tabs/providers/local/common/types';
import { OpenAILikeApiClient } from './api';
import { useServerStatus } from '~/components/@settings/tabs/providers/local/common/hooks';
import { useModelList } from '~/components/@settings/tabs/providers/local/common/hooks'; // Import the new hook
import { motion } from 'framer-motion';
import { SiOpenai } from 'react-icons/si';
import { cn } from '~/utils/classNames';

interface OpenAiLikeProviderProps {
  onSettingsChange?: (settings: ProviderSettings) => void;
}

export default function OpenAiLikeProvider({ onSettingsChange: _onSettingsChange }: OpenAiLikeProviderProps) {
  const { settings, updateSettings } = useProviderSettings('OpenAILike');
  const [apiClient, setApiClient] = React.useState<OpenAILikeApiClient | null>(null);
  const [isUrlEditing, setIsUrlEditing] = React.useState(false);
  const [urlInput, setUrlInput] = React.useState(settings?.baseUrl || 'http://localhost:8080');
  const [isApiKeyEditing, setIsApiKeyEditing] = React.useState(false);
  const [apiKeyInput, setApiKeyInput] = React.useState(settings?.apiKey || '');
  const [error, setError] = React.useState<string | null>(null);

  // Initialize API client when settings change
  React.useEffect(() => {
    if (settings?.baseUrl) {
      const client = new OpenAILikeApiClient(settings.baseUrl, settings.apiKey || undefined);
      setApiClient(client);
    }
  }, [settings?.baseUrl, settings?.apiKey]);

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
  } = useModelList('OpenAILike', apiClient, isRunning);

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
    setUrlInput(settings.baseUrl || 'http://localhost:8080');
    setIsUrlEditing(true);
  };

  const handleApiKeyChange = () => {
    if (apiKeyInput !== settings.apiKey) {
      updateSettings({ apiKey: apiKeyInput });
    }

    setIsApiKeyEditing(false);
  };

  const startApiKeyEditing = () => {
    setApiKeyInput(settings.apiKey || '');
    setIsApiKeyEditing(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-bolt-elements-background-depth-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
            <SiOpenai className="text-green-500 text-xl" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-bolt-elements-textPrimary">OpenAI-Like</h3>
            <p className="text-sm text-bolt-elements-textSecondary">
              Connect to any OpenAI-compatible API endpoint to use with your application.
            </p>
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
            <label className="text-sm font-medium text-bolt-elements-textSecondary">API Endpoint</label>
            {isUrlEditing ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1"
                  placeholder="https://api.example.com"
                />
                <Button onClick={handleUrlChange}>Save</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUrlInput(settings.baseUrl || 'http://localhost:8080');
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
                {settings.baseUrl || 'Click to set API endpoint'}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-bolt-elements-textSecondary">API Key</label>
            {isApiKeyEditing ? (
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="flex-1"
                  placeholder="sk-..."
                />
                <Button onClick={handleApiKeyChange}>Save</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setApiKeyInput(settings.apiKey || '');
                    setIsApiKeyEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                onClick={startApiKeyEditing}
                className={cn(
                  'px-3 py-2 rounded-lg cursor-pointer',
                  'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                  'text-bolt-elements-textPrimary',
                  'hover:bg-bolt-elements-background-depth-4',
                  'transition-colors',
                )}
              >
                {settings.apiKey ? '••••••••' : 'Click to set API key'}
              </div>
            )}
          </div>

          {/* Models */}
          {isRunning && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-bolt-elements-textSecondary">Available Models</label>
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
                      className="p-3 rounded-lg bg-bolt-elements-surface border border-bolt-elements-border flex items-center justify-between"
                    >
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-bolt-elements-textSecondary">{model.desc}</div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full" onClick={refreshModels}>
                    Refresh Models
                  </Button>
                </div>
              ) : (
                <div className="text-sm text-bolt-elements-textSecondary">No models available</div>
              )}
            </div>
          )}

          <div className="text-sm text-bolt-elements-textSecondary">
            <p>Examples: LocalAI, vLLM, or any server that implements the OpenAI API spec.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
