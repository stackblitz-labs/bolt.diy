import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Progress } from '~/components/ui/Progress';
import { useToast } from '~/components/ui/use-toast';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';

interface OllamaModelLibraryProps {
  baseUrl: string;
  isConnected: boolean;
  onModelInstalled: (modelName: string, isUpdate?: boolean) => void;
}

interface InstallProgress {
  status: string;
  progress: number;
  downloadedSize?: string;
  totalSize?: string;
  speed?: string;
}

interface ModelInfo {
  name: string;
  desc: string;
  size: string;
  tags: string[];
  source?: 'library' | 'featured';
}

// Track installed models
interface InstalledModelInfo {
  name: string;
  digest?: string;
}

/*
 * Popular models from the Ollama library
 * This serves as a fallback and for featured models
 */
const FEATURED_MODELS: ModelInfo[] = [
  {
    name: 'deepseek-coder:6.7b',
    desc: "DeepSeek's code generation model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
    source: 'featured',
  },
  {
    name: 'llama2:7b',
    desc: "Meta's Llama 2 (7B parameters)",
    size: '3.8GB',
    tags: ['general', 'popular'],
    source: 'featured',
  },
  {
    name: 'mistral:7b',
    desc: "Mistral's 7B model",
    size: '4.1GB',
    tags: ['general', 'popular'],
    source: 'featured',
  },
  {
    name: 'gemma:7b',
    desc: "Google's Gemma model",
    size: '4.0GB',
    tags: ['general', 'new'],
    source: 'featured',
  },
  {
    name: 'codellama:7b',
    desc: "Meta's Code Llama model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
    source: 'featured',
  },
  {
    name: 'neural-chat:7b',
    desc: "Intel's Neural Chat model",
    size: '4.1GB',
    tags: ['chat', 'popular'],
    source: 'featured',
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

// Ollama Icon SVG component
function OllamaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor">
      <path d="M684.3 322.2H339.8c-9.5.1-17.7 6.8-19.6 16.1-8.2 41.4-12.4 83.5-12.4 125.7 0 42.2 4.2 84.3 12.4 125.7 1.9 9.3 10.1 16 19.6 16.1h344.5c9.5-.1 17.7-6.8 19.6-16.1 8.2-41.4 12.4-83.5 12.4-125.7 0-42.2-4.2-84.3-12.4-125.7-1.9-9.3-10.1-16-19.6-16.1zM512 640c-176.7 0-320-143.3-320-320S335.3 0 512 0s320 143.3 320 320-143.3 320-320 320z" />
    </svg>
  );
}

export default function OllamaModelLibrary({ baseUrl, onModelInstalled, isConnected }: OllamaModelLibraryProps) {
  const [modelString, setModelString] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([...FEATURED_MODELS]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<InstalledModelInfo[]>([]);
  const [isLoadingInstalledModels, setIsLoadingInstalledModels] = useState(false);
  const { toast } = useToast();
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to fetch installed models list
  const fetchInstalledModels = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingInstalledModels(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Failed to fetch installed models: ${response.status}`);
        return;
      }

      interface OllamaTagsResponse {
        models?: Array<{
          name: string;
          digest?: string;
        }>;
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const fetchedModels = data.models || [];

      console.log('Fetched installed models for filtering library:', fetchedModels);

      setInstalledModels(
        fetchedModels.map((model) => ({
          name: model.name,
          digest: model.digest,
        })),
      );
    } catch (error) {
      console.error('Error fetching installed models:', error);
    } finally {
      setIsLoadingInstalledModels(false);
    }
  }, [baseUrl, isConnected]);

  // Fetch installed models on mount and when connection status changes
  useEffect(() => {
    if (isConnected) {
      fetchInstalledModels();
    }
  }, [isConnected, fetchInstalledModels]);

  // Function to fetch models from Ollama library
  const fetchLibraryModels = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingLibrary(true);
    setLibraryError(null);

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      // First try the Ollama library API endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

      // Use the manifest endpoint to get available models
      const response = await fetch(`${baseUrl}/api/manifest`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // If we can't access the library, use our featured models
        console.log('Could not fetch from Ollama library API, using featured models');
        setModels([...FEATURED_MODELS]);

        return;
      }

      interface OllamaManifestResponse {
        models?: Record<
          string,
          {
            description?: string;
            size?: number;
            tags?: string[];
          }
        >;
        [key: string]: any;
      }

      const data = (await response.json()) as OllamaManifestResponse;

      // Parse the manifest data
      if (data && data.models) {
        const libraryModels = Object.entries(data.models).map(([key, value]: [string, any]) => {
          // Extract relevant information
          const modelInfo: ModelInfo = {
            name: key,
            desc: value.description || `Ollama model: ${key}`,

            // Estimate size if not available
            size: value.size ? formatBytes(value.size) : 'Size varies',

            // Add appropriate tags based on model details
            tags: value.tags || ['general'],
            source: 'library',
          };
          return modelInfo;
        });

        // Combine featured models with library models
        const allModels = [...FEATURED_MODELS, ...libraryModels];

        // Remove duplicates (prefer featured models)
        const modelMap = new Map<string, ModelInfo>();
        allModels.forEach((model) => {
          const baseName = model.name.split(':')[0];

          if (!modelMap.has(baseName) || model.source === 'featured') {
            modelMap.set(baseName, model);
          }
        });

        setModels(Array.from(modelMap.values()));
      } else {
        // Fallback to featured models if no data
        setModels([...FEATURED_MODELS]);
      }
    } catch (error) {
      console.error('Error fetching Ollama library:', error);
      setLibraryError(error instanceof Error ? error.message : 'Unknown error');
      setModels([...FEATURED_MODELS]); // Use featured models as fallback
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [baseUrl, isConnected]);

  // Fetch models when component mounts
  useEffect(() => {
    if (isConnected) {
      fetchLibraryModels();
    }
  }, [isConnected, fetchLibraryModels]);

  // Handler for installing a model
  const handleInstallModel = async (modelToInstall: string) => {
    if (!isConnected) {
      toast('Ollama server is not connected', { type: 'error' });
      return;
    }

    if (!modelToInstall) {
      toast('Please enter a model name', { type: 'error' });
      return;
    }

    setIsInstalling(true);
    setInstallProgress({
      status: 'Starting installation...',
      progress: 0,
    });

    let lastTime = Date.now();
    let lastBytes = 0;

    try {
      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelToInstall }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      let progressJson = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Convert the Uint8Array to a string
        const chunk = new TextDecoder('utf-8').decode(value);
        progressJson += chunk;

        // Process each line of JSON
        const lines = progressJson.split('\n');
        progressJson = lines.pop() || ''; // Keep the last incomplete line

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            /* console.log('Progress data:', data); */
            if ('status' in data) {
              const currentTime = Date.now();
              const timeDiff = (currentTime - lastTime) / 1000; // Convert to seconds
              const bytesDiff = (data.completed || 0) - lastBytes;
              const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

              setInstallProgress({
                status: data.status ? data.status.replace(/[^\x20-\x7E]/g, '') : 'Installing...',
                progress: data.completed && data.total ? (data.completed / data.total) * 100 : 0,
                downloadedSize: formatBytes(data.completed || 0),
                totalSize: data.total ? formatBytes(data.total) : 'Calculating...',
                speed: formatSpeed(speed),
              });

              lastTime = currentTime;
              lastBytes = data.completed || 0;
            }
          } catch (err) {
            console.error('Error parsing progress:', err);
          }
        }
      }

      // Keep the progress indicator visible for a moment after completion
      setInstallProgress({
        status: 'Installation complete!',
        progress: 100,
        downloadedSize: 'Complete',
        totalSize: 'Complete',
        speed: '0 B/s',
      });

      // Now that installation is successful, clear the model string and search query
      setModelString('');
      setSearchQuery('');

      toast('Model Installed Successfully');

      // Refresh the installed models list
      fetchInstalledModels();

      /*
       * Ensure we call onModelInstalled after successful installation
       * Use a small delay to ensure the server has time to register the new model
       */
      checkTimeoutRef.current = setTimeout(() => {
        console.log(`Installation of ${modelToInstall} completed, refreshing model list`);

        /*
         * Notify parent component with multiple attempts
         * This ensures we catch the new model even if Ollama is slow to register it
         */
        if (onModelInstalled) {
          // First immediate call
          onModelInstalled(modelToInstall);

          // Additional calls with increasing delays
          setTimeout(() => onModelInstalled(modelToInstall), 1000);
          setTimeout(() => onModelInstalled(modelToInstall), 3000);
        }

        // Clear the progress indicator after a delay
        setTimeout(() => {
          setInstallProgress(null);
        }, 2000);
      }, 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error installing ${modelToInstall}:`, errorMessage);

      toast(`Error installing model: ${errorMessage}`, { type: 'error' });

      // Show error in progress indicator
      setInstallProgress({
        status: `Error: ${errorMessage}`,
        progress: 0,
        downloadedSize: 'Failed',
        totalSize: 'Failed',
        speed: '0 B/s',
      });

      // Clear the error progress after a delay
      setTimeout(() => {
        setInstallProgress(null);
      }, 3000);
    } finally {
      setIsInstalling(false);
    }
  };

  /*
   * Filter models based on search query and tags
   * Also filter out already installed models
   */
  const filteredModels = models.filter((model) => {
    // Check if this model is already installed
    const isInstalled = installedModels.some((installedModel) => {
      // Check for exact match or if the base name matches (without tag)
      const baseModelName = model.name.split(':')[0];
      const installedBaseName = installedModel.name.split(':')[0];

      // Handle exact matches and version/tag variations
      return model.name === installedModel.name || (baseModelName === installedBaseName && model.name.includes(':'));
    });

    // Filter out installed models
    if (isInstalled) {
      return false;
    }

    // Apply user search filters
    const matchesSearch =
      searchQuery === '' ||
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.desc.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => model.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  // Extract all unique tags from models
  const allTags = Array.from(new Set(models.flatMap((model) => model.tags)));

  // Function to refresh both library and installed models
  const refreshAll = () => {
    fetchInstalledModels();
    fetchLibraryModels();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Ollama Models Section */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <OllamaIcon className="w-6 h-6 text-bolt-elements-button-primary-text" />
            <h2 className="text-xl font-semibold">Ollama Models Library</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshAll}
              className="flex items-center bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover"
              disabled={isLoadingLibrary || !isConnected || isLoadingInstalledModels}
            >
              {isLoadingLibrary || isLoadingInstalledModels ? (
                <div className="i-ph:spinner-gap-bold animate-spin mr-1" />
              ) : (
                <span className="i-ph:arrows-clockwise mr-1 text-bolt-elements-textPrimary" />
              )}
              <span>Refresh Library</span>
            </Button>
          </div>
        </div>

        <p className="text-sm text-bolt-elements-textSecondary mb-3">
          Browse and install models from the Ollama library
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              type="text"
              className="w-full bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary border-bolt-elements-borderColor"
              placeholder="Search models or enter custom model name..."
              value={searchQuery || modelString}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setModelString(value);
              }}
              disabled={isInstalling || !isConnected}
            />
            <p className="text-xs text-bolt-elements-textSecondary mt-1">
              Browse models at{' '}
              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-bolt-elements-button-primary-text hover:underline"
              >
                ollama.com/library
                <span className="i-ph:arrow-square-out text-sm text-bolt-elements-button-primary-text" />
              </a>{' '}
              and copy model names to install
            </p>
          </div>
          <Button
            variant="default"
            size="default"
            onClick={() => handleInstallModel(modelString)}
            className="w-full sm:w-auto whitespace-nowrap bg-bolt-elements-button-primary-background"
            disabled={!modelString || isInstalling || !isConnected}
          >
            <div className="flex items-center justify-center">
              {isInstalling ? (
                <>
                  <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4 mr-2 text-bolt-elements-textPrimary" />
                  <span>Installing...</span>
                </>
              ) : (
                <>
                  <span className="i-ph:download mr-2 text-bolt-elements-textPrimary" />
                  <span>Install Model</span>
                </>
              )}
            </div>
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
                }}
                className={classNames('text-xs', {
                  'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text':
                    selectedTags.includes(tag),
                })}
                disabled={!isConnected}
              >
                {tag}
              </Button>
            ))}
          </div>
        )}

        {libraryError && (
          <div className="flex items-center gap-2 p-4 bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary border-l-4 border-bolt-elements-button-danger-text rounded-lg">
            <span className="i-ph:warning-circle w-5 h-5 text-bolt-elements-button-danger-text" />
            <div className="flex-1">
              <p className="text-sm">Could not fetch Ollama library: {libraryError}</p>
              <p className="text-xs text-bolt-elements-textSecondary">Showing featured models only</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLibraryModels}
              className="ml-auto"
              disabled={isLoadingLibrary}
            >
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          {isLoadingLibrary ? (
            <>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor animate-pulse h-32"
                />
              ))}
            </>
          ) : !isConnected ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 p-8 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
              <div className="i-ph:cube-transparent w-12 h-12 text-bolt-elements-textPrimary" />
              <p className="text-lg font-medium">Ollama server is not connected</p>
              <p className="text-sm text-bolt-elements-textSecondary">Connect to Ollama to browse and install models</p>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 p-8 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
              <div className="i-ph:cube-transparent w-12 h-12 text-bolt-elements-textPrimary" />
              <p className="text-lg font-medium">No models found matching your search</p>
              <p className="text-sm text-bolt-elements-textSecondary">Try a different search term or tag filter</p>
            </div>
          ) : (
            filteredModels.map((model) => (
              <motion.div
                key={model.name}
                className="bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start">
                    <OllamaIcon className="w-7 h-7 text-bolt-elements-button-primary-text mr-3 flex-shrink-0" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-medium">{model.name}</h3>
                        {model.source === 'featured' && (
                          <span className="px-1.5 py-0.5 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text text-xs rounded-full">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-bolt-elements-textSecondary mt-0.5">{model.desc}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded">
                        {model.size}
                      </span>
                      {model.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInstallModel(model.name)}
                        className="bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-button-primary-backgroundHover min-w-16 justify-center"
                        disabled={isInstalling}
                      >
                        <span className="i-ph:download mr-1 text-bolt-elements-textPrimary" />
                        <span>Install</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {installProgress && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-bolt-elements-background-depth-2 p-3 rounded-lg border border-bolt-elements-borderColor shadow-lg z-50"
        >
          <div className="flex flex-col mb-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium truncate max-w-[70%]" title={installProgress.status}>
                {installProgress.status}
              </span>
              <span className="text-xs text-bolt-elements-textSecondary">{Math.round(installProgress.progress)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-bolt-elements-textSecondary">
              <span>
                {installProgress.downloadedSize} / {installProgress.totalSize}
              </span>
              <span>{installProgress.speed}</span>
            </div>
          </div>
          <Progress value={installProgress.progress} className="h-1.5" />
        </motion.div>
      )}
    </div>
  );
}
