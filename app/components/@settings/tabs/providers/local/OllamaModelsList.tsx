import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Button } from '~/components/ui/Button';
import { useToast } from '~/components/ui/use-toast';

interface OllamaModelsListProps {
  baseUrl: string;
  onActionComplete?: () => void;
  isConnected: boolean;
}

// Export the ref interface to be used by parent components
export interface OllamaModelsListRef {
  refreshModels: (refreshNow?: boolean) => void;
}

interface ModelInfo {
  name: string;
  size: string;
  installedVersion?: string;
  latestVersion?: string;
  needsUpdate?: boolean;
  status?: 'idle' | 'updating' | 'deleting' | 'updated' | 'error' | 'pending';
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  progress?: number;
}

const STORAGE_KEY = 'ollama-pending-installations';

// Interface for pending installations in storage
interface PendingInstallation {
  name: string;
  type: 'install' | 'update';
  startedAt: number;
}

const OllamaModelsList = forwardRef<OllamaModelsListRef, OllamaModelsListProps>(
  ({ baseUrl, onActionComplete, isConnected }, ref) => {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const abortControllerRef = useRef<AbortController | null>(null);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track pending installations
    const getPendingInstallations = useCallback((): PendingInstallation[] => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      } catch (err) {
        console.error('Error reading pending installations from storage:', err);
        return [];
      }
    }, []);

    const savePendingInstallation = useCallback(
      (name: string, type: 'install' | 'update') => {
        try {
          const pendingInstallations = getPendingInstallations();

          // Remove any existing entries for this model
          const filtered = pendingInstallations.filter((p) => p.name !== name);

          // Add new pending installation
          const updated = [...filtered, { name, type, startedAt: Date.now() }];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error('Error saving pending installation to storage:', err);
        }
      },
      [getPendingInstallations],
    );

    const removePendingInstallation = useCallback(
      (name: string) => {
        try {
          const pendingInstallations = getPendingInstallations();
          const updated = pendingInstallations.filter((p) => p.name !== name);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (err) {
          console.error('Error removing pending installation from storage:', err);
        }
      },
      [getPendingInstallations],
    );

    // Format file size for display
    const formatSize = (bytes: number): string => {
      if (bytes === 0) {
        return '0 B';
      }

      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));

      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    // Function to fetch installed models with error handling
    const fetchInstalledModels = useCallback(
      async (showToast = false, retryCount = 0) => {
        if (!isConnected) {
          setError('Ollama server is not connected');
          setModels([]);

          return [];
        }

        try {
          setIsLoading(true);
          setError(null);

          // Cancel any previous requests
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }

          // Create new abort controller
          abortControllerRef.current = new AbortController();

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

          const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`Failed to fetch installed models: ${response.status} ${response.statusText}`);
          }

          interface OllamaTagsResponse {
            models?: Array<{
              name: string;
              digest?: string;
              latest?: string;
              size: number;
              details?: {
                family?: string;
                parameter_size?: string;
                quantization_level?: string;
              };
            }>;
          }

          const data = (await response.json()) as OllamaTagsResponse;
          const installedModels = data.models || [];

          console.log('Installed models from Ollama:', installedModels);

          // Get pending installations from localStorage
          const pendingInstallations = getPendingInstallations();
          console.log('Pending installations:', pendingInstallations);

          // Process installed models
          const modelList: ModelInfo[] = installedModels.map((model: any) => {
            // Format size for display
            const formattedSize = formatSize(model.size);

            // Check if this model has a pending installation
            const pendingInstall = pendingInstallations.find((p) => p.name === model.name);
            const isInstalling = pendingInstall !== undefined;

            return {
              name: model.name,
              size: formattedSize,
              installedVersion: model.digest?.substring(0, 8),
              needsUpdate: model.digest !== model.latest || pendingInstall?.type === 'update',
              latestVersion: model.latest?.substring(0, 8),
              status: isInstalling ? (pendingInstall.type === 'update' ? 'updating' : 'pending') : 'idle',
              details: model.details,
            };
          });

          // Add models that are in pending installation but not yet in installed list
          pendingInstallations.forEach((pending) => {
            const exists = modelList.some((m) => m.name === pending.name);

            if (!exists) {
              modelList.push({
                name: pending.name,
                size: 'Installing...',
                status: pending.type === 'update' ? 'updating' : 'pending',
                needsUpdate: pending.type === 'update',
              });
            }
          });

          setModels(modelList);

          if (showToast) {
            toast(`Found ${installedModels.length} installed models`);
          }

          return modelList;
        } catch (error) {
          console.error('Error checking installed models:', error);

          let errorMessage: string;

          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              errorMessage = 'Request timed out';
            } else {
              errorMessage = error.message;
            }
          } else {
            errorMessage = 'Unknown error';
          }

          /*
           * Implement retry mechanism for transient failures
           * This is particularly helpful when a model was just installed
           * and the Ollama API hasn't fully registered it yet
           */
          if (retryCount < 3) {
            console.log(`Retry attempt ${retryCount + 1} for fetching models after error: ${errorMessage}`);

            // Exponential backoff - wait longer for each retry
            const delay = Math.pow(2, retryCount) * 500;

            setTimeout(() => {
              fetchInstalledModels(showToast, retryCount + 1);
            }, delay);

            return [];
          }

          setError(errorMessage);

          if (showToast) {
            toast(`Failed to fetch models: ${errorMessage}`, { type: 'error' });
          }

          return [];
        } finally {
          setIsLoading(false);
          abortControllerRef.current = null;
        }
      },
      [baseUrl, isConnected, toast, getPendingInstallations],
    );

    // Define refresh models method to expose through ref
    useImperativeHandle(ref, () => ({
      refreshModels: (refreshNow = false) => {
        console.log('RefreshModels called from parent component');

        if (refreshNow) {
          // Immediate refresh when explicitly requested
          fetchInstalledModels(false);
        } else {
          // Debounced refresh for other cases
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }

          refreshTimeoutRef.current = setTimeout(() => {
            fetchInstalledModels(false);
          }, 300);
        }
      },
    }));

    // Handle model deletion
    const handleDeleteModel = async (modelName: string) => {
      if (!isConnected) {
        toast('Cannot delete model: Ollama server is not connected', { type: 'error' });
        return;
      }

      try {
        // Update UI to show deletion in progress
        setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'deleting' } : m)));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        // The correct Ollama API endpoint for deleting a model
        const response = await fetch(`${baseUrl}/api/delete`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: modelName }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to delete model: ${response.statusText}`, errorText);
          throw new Error(`Failed to delete model: ${response.statusText} - ${errorText}`);
        }

        console.log(`Successfully deleted model: ${modelName}`);

        // Remove the model from the local state
        setModels((prev) => prev.filter((m) => m.name !== modelName));

        toast(`Model ${modelName} deleted successfully`);

        // Notify parent component
        if (onActionComplete) {
          onActionComplete();
        }

        // Refresh the model list
        setTimeout(() => {
          fetchInstalledModels();
        }, 1000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`Error deleting ${modelName}:`, errorMessage);
        toast(`Error deleting model: ${errorMessage}`, { type: 'error' });

        // Reset the model status
        setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'error' } : m)));

        // Try to reset the status after a delay
        setTimeout(() => {
          setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'idle' } : m)));
        }, 3000);
      }
    };

    // Handle model update
    const handleUpdateModel = async (modelName: string) => {
      if (!isConnected) {
        toast('Cannot update model: Ollama server is not connected', { type: 'error' });
        return;
      }

      try {
        // Update UI to show update in progress
        setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

        // Track this installation in localStorage
        savePendingInstallation(modelName, 'update');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for updates

        const response = await fetch(`${baseUrl}/api/pull`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: modelName }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error('Failed to get response reader');
        }

        while (true) {
          const { done } = await reader.read();

          if (done) {
            break;
          }
        }

        // Remove from pending installations
        removePendingInstallation(modelName);

        // Set status to updated
        setModels((prev) =>
          prev.map((m) => (m.name === modelName ? { ...m, status: 'updated', needsUpdate: false } : m)),
        );

        toast(`Model ${modelName} updated successfully`);

        // Notify parent component
        if (onActionComplete) {
          onActionComplete();
        }

        // Reset status after a delay
        setTimeout(() => {
          setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'idle' } : m)));
          fetchInstalledModels();
        }, 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`Error updating ${modelName}:`, errorMessage);
        toast(`Error updating model: ${errorMessage}`, { type: 'error' });

        // Reset the model status
        setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'error' } : m)));

        // Try to reset the status after a delay
        setTimeout(() => {
          setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'idle' } : m)));
        }, 3000);
      }
    };

    // Resume a pending installation
    const resumeInstallation = async (modelName: string) => {
      try {
        const pendingInstallations = getPendingInstallations();
        const pending = pendingInstallations.find((p) => p.name === modelName);

        if (!pending) {
          toast(`No pending installation found for ${modelName}`, { type: 'error' });
          return;
        }

        if (pending.type === 'update') {
          handleUpdateModel(modelName);
        } else {
          // For install, we call pull API directly since we don't have the original installModel function
          setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'pending' } : m)));

          const response = await fetch(`${baseUrl}/api/pull`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: modelName }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();

          if (!reader) {
            throw new Error('Failed to get response reader');
          }

          while (true) {
            const { done } = await reader.read();

            if (done) {
              break;
            }
          }

          removePendingInstallation(modelName);
          toast(`Model ${modelName} installed successfully`);
          fetchInstalledModels();
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error(`Error resuming installation for ${modelName}:`, errorMessage);
        toast(`Error resuming installation: ${errorMessage}`, { type: 'error' });
      }
    };

    // Fetch models on mount
    useEffect(() => {
      if (isConnected) {
        fetchInstalledModels();
      }

      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, [baseUrl, isConnected, fetchInstalledModels]);

    // Ollama Icon SVG component
    function OllamaIcon({ className }: { className?: string }) {
      return (
        <svg viewBox="0 0 1024 1024" className={className} fill="currentColor">
          <path d="M684.3 322.2H339.8c-9.5.1-17.7 6.8-19.6 16.1-8.2 41.4-12.4 83.5-12.4 125.7 0 42.2 4.2 84.3 12.4 125.7 1.9 9.3 10.1 16 19.6 16.1h344.5c9.5-.1 17.7-6.8 19.6-16.1 8.2-41.4 12.4-83.5 12.4-125.7 0-42.2-4.2-84.3-12.4-125.7-1.9-9.3-10.1-16-19.6-16.1zM512 640c-176.7 0-320-143.3-320-320S335.3 0 512 0s320 143.3 320 320-143.3 320-320 320z" />
        </svg>
      );
    }

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <OllamaIcon className="w-6 h-6 text-bolt-elements-button-primary-text" />
            <h2 className="text-xl font-semibold">Installed Models</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchInstalledModels(true)}
              className="flex items-center bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="i-ph:spinner-gap-bold animate-spin mr-1" />
              ) : (
                <span className="i-ph:arrows-clockwise mr-1 text-bolt-elements-textPrimary" />
              )}
              <span>Refresh</span>
            </Button>

            {models.length > 0 && (
              <span className="text-sm text-bolt-elements-textSecondary">
                {models.length} {models.length === 1 ? 'model' : 'models'} available
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-bolt-elements-textSecondary mb-3">Manage your locally installed Ollama models</p>

        {error && (
          <div className="flex items-center gap-2 p-4 bg-bolt-elements-background-depth-3 text-bolt-elements-button-danger-text rounded-lg">
            <span className="i-ph:warning-circle w-5 h-5" />
            <span>Error: {error}</span>
            <Button variant="outline" size="sm" onClick={() => fetchInstalledModels(true)} className="ml-auto">
              Retry
            </Button>
          </div>
        )}

        {models.length === 0 ? (
          <div className="bg-bolt-elements-background-depth-2 p-6 rounded-lg border border-bolt-elements-borderColor flex flex-col items-center justify-center gap-2">
            <div className="i-ph:cube-transparent w-12 h-12 text-bolt-elements-textPrimary" />
            <p className="text-lg font-medium">No installed models</p>
            <p className="text-sm text-bolt-elements-textSecondary">
              {error
                ? 'Error connecting to Ollama server'
                : isLoading
                  ? 'Loading models...'
                  : 'Install models from the list below'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
            {models.map((model) => (
              <motion.div
                key={model.name}
                className={classNames(
                  'bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors h-full',
                  {
                    'opacity-70': model.status === 'updating' || model.status === 'deleting',
                    'border-bolt-elements-button-danger-text': model.status === 'error',
                    'border-bolt-elements-button-success-text': model.status === 'updated',
                    'border-bolt-elements-button-warning-text': model.status === 'pending',
                  },
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col justify-between h-full">
                  <div className="flex items-start mb-3">
                    <OllamaIcon className="w-7 h-7 text-bolt-elements-button-primary-text mr-3 flex-shrink-0" />
                    <div className="flex flex-col">
                      <h3 className="text-base font-medium">{model.name}</h3>
                      <div className="text-xs text-bolt-elements-textSecondary mt-0.5">
                        {model.status === 'pending' ? (
                          <span className="text-bolt-elements-button-warning-text">Installation pending</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            {model.installedVersion && <span>{model.installedVersion}</span>}
                            {model.installedVersion && <span className="mx-1">•</span>}
                            <span>{model.size}</span>
                            {model.details?.parameter_size && (
                              <>
                                <span className="mx-1">•</span>
                                <span>{model.details.parameter_size}</span>
                              </>
                            )}
                            {model.details?.quantization_level && (
                              <>
                                <span className="mx-1">•</span>
                                <span>{model.details.quantization_level}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Model tags */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded">
                      {model.size}
                    </span>
                    {model.details?.family && (
                      <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded">
                        {model.details.family}
                      </span>
                    )}
                    {model.details?.parameter_size && (
                      <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded">
                        {model.details.parameter_size}
                      </span>
                    )}
                    {model.details?.quantization_level && (
                      <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded">
                        {model.details.quantization_level}
                      </span>
                    )}
                    {model.needsUpdate && (
                      <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-button-warning-background text-bolt-elements-button-warning-text rounded">
                        Update available
                      </span>
                    )}
                  </div>

                  {model.status === 'pending' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resumeInstallation(model.name)}
                      className="w-full justify-center bg-bolt-elements-background-depth-1 text-bolt-elements-button-warning-text"
                    >
                      <span className="i-ph:play mr-1" />
                      <span>Resume</span>
                    </Button>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete ${model.name}?`)) {
                            handleDeleteModel(model.name);
                          }
                        }}
                        className="flex items-center bg-bolt-elements-background-depth-1 text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover justify-center flex-1"
                        disabled={model.status === 'updating' || model.status === 'deleting'}
                      >
                        {model.status === 'deleting' ? (
                          <>
                            <div className="i-ph:spinner-gap-bold animate-spin mr-1 text-bolt-elements-textPrimary" />
                            <span>Deleting...</span>
                          </>
                        ) : (
                          <>
                            <span className="i-ph:trash mr-1 text-bolt-elements-button-danger-text" />
                            <span>Delete</span>
                          </>
                        )}
                      </Button>
                      {model.needsUpdate ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateModel(model.name)}
                          className="flex items-center bg-bolt-elements-background-depth-1 justify-center flex-1"
                          disabled={model.status === 'updating' || model.status === 'deleting'}
                        >
                          {model.status === 'updating' ? (
                            <>
                              <div className="i-ph:spinner-gap-bold animate-spin mr-1 text-bolt-elements-textPrimary" />
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <span className="i-ph:arrows-clockwise mr-1 text-bolt-elements-textPrimary" />
                              <span>Update</span>
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center bg-bolt-elements-background-depth-1 justify-center flex-1 opacity-50 cursor-not-allowed"
                          disabled={true}
                        >
                          <span className="i-ph:check mr-1 text-bolt-elements-button-success-text" />
                          <span>Up to date</span>
                        </Button>
                      )}
                    </div>
                  )}

                  {model.status === 'error' && (
                    <div className="mt-2 text-xs text-bolt-elements-button-danger-text">
                      Error during operation. Please try again.
                    </div>
                  )}
                  {model.status === 'pending' && (
                    <div className="mt-2 text-xs text-bolt-elements-button-warning-text">
                      Installation was interrupted. Click Resume to continue.
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export default OllamaModelsList;
