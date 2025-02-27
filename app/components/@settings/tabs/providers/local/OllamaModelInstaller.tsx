import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/utils/classNames';
import { Progress } from '~/components/ui/Progress';
import { useToast } from '~/components/ui/use-toast';
import { useSettings } from '~/lib/hooks/useSettings';
import { Input } from '~/components/ui/Input';
import { Button } from '~/components/ui/Button';
import { Badge } from '~/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { FiSearch, FiExternalLink, FiRefreshCw, FiDownload, FiTrash2, FiArrowUp } from 'react-icons/fi';

interface OllamaModelInstallerProps {
  onModelInstalled: () => void;
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
  installedVersion?: string;
  latestVersion?: string;
  needsUpdate?: boolean;
  status?: 'idle' | 'installing' | 'updating' | 'updated' | 'error';
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

const POPULAR_MODELS: ModelInfo[] = [
  {
    name: 'deepseek-coder:6.7b',
    desc: "DeepSeek's code generation model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
  },
  {
    name: 'llama2:7b',
    desc: "Meta's Llama 2 (7B parameters)",
    size: '3.8GB',
    tags: ['general', 'popular'],
  },
  {
    name: 'mistral:7b',
    desc: "Mistral's 7B model",
    size: '4.1GB',
    tags: ['general', 'popular'],
  },
  {
    name: 'gemma:7b',
    desc: "Google's Gemma model",
    size: '4.0GB',
    tags: ['general', 'new'],
  },
  {
    name: 'codellama:7b',
    desc: "Meta's Code Llama model",
    size: '4.1GB',
    tags: ['coding', 'popular'],
  },
  {
    name: 'neural-chat:7b',
    desc: "Intel's Neural Chat model",
    size: '4.1GB',
    tags: ['chat', 'popular'],
  },
  {
    name: 'phi:latest',
    desc: "Microsoft's Phi-2 model",
    size: '2.7GB',
    tags: ['small', 'fast'],
  },
  {
    name: 'qwen:7b',
    desc: "Alibaba's Qwen model",
    size: '4.1GB',
    tags: ['general'],
  },
  {
    name: 'solar:10.7b',
    desc: "Upstage's Solar model",
    size: '6.1GB',
    tags: ['large', 'powerful'],
  },
  {
    name: 'openchat:7b',
    desc: 'Open-source chat model',
    size: '4.1GB',
    tags: ['chat', 'popular'],
  },
  {
    name: 'dolphin-phi:2.7b',
    desc: 'Lightweight chat model',
    size: '1.6GB',
    tags: ['small', 'fast'],
  },
  {
    name: 'stable-code:3b',
    desc: 'Lightweight coding model',
    size: '1.8GB',
    tags: ['coding', 'small'],
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

// Add Ollama Icon SVG component
function OllamaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor">
      <path d="M684.3 322.2H339.8c-9.5.1-17.7 6.8-19.6 16.1-8.2 41.4-12.4 83.5-12.4 125.7 0 42.2 4.2 84.3 12.4 125.7 1.9 9.3 10.1 16 19.6 16.1h344.5c9.5-.1 17.7-6.8 19.6-16.1 8.2-41.4 12.4-83.5 12.4-125.7 0-42.2-4.2-84.3-12.4-125.7-1.9-9.3-10.1-16-19.6-16.1zM512 640c-176.7 0-320-143.3-320-320S335.3 0 512 0s320 143.3 320 320-143.3 320-320 320z" />
    </svg>
  );
}

export default function OllamaModelInstaller({ onModelInstalled }: OllamaModelInstallerProps) {
  const [modelString, setModelString] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>(POPULAR_MODELS);
  const { toast } = useToast();
  const { providers } = useSettings();

  // Get base URL from provider settings
  const baseUrl = providers?.Ollama?.settings?.baseUrl || 'http://127.0.0.1:11434';

  // Function to check installed models and their versions
  const checkInstalledModels = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch installed models');
      }

      const data = (await response.json()) as { models: Array<{ name: string; digest: string; latest: string }> };
      const installedModels = data.models || [];

      // Update models with installed versions
      setModels((prevModels) =>
        prevModels.map((model) => {
          const installed = installedModels.find((m) => m.name.toLowerCase() === model.name.toLowerCase());

          if (installed) {
            return {
              ...model,
              installedVersion: installed.digest.substring(0, 8),
              needsUpdate: installed.digest !== installed.latest,
              latestVersion: installed.latest?.substring(0, 8),
            };
          }

          return model;
        }),
      );
    } catch (error) {
      console.error('Error checking installed models:', error);
    }
  };

  const handleInstallModel = async (modelToInstall: string) => {
    if (!modelToInstall) {
      return;
    }

    try {
      setIsInstalling(true);
      setInstallProgress({
        status: 'Starting download...',
        progress: 0,
        downloadedSize: '0 B',
        totalSize: 'Calculating...',
        speed: '0 B/s',
      });
      setModelString('');
      setSearchQuery('');

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

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let lastTime = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if ('status' in data) {
              const currentTime = Date.now();
              const timeDiff = (currentTime - lastTime) / 1000; // Convert to seconds
              const bytesDiff = (data.completed || 0) - lastBytes;
              const speed = bytesDiff / timeDiff;

              setInstallProgress({
                status: data.status,
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

      toast(`Successfully installed ${modelToInstall}`);

      // Ensure we call onModelInstalled after successful installation
      setTimeout(() => {
        onModelInstalled();
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error installing ${modelToInstall}:`, errorMessage);
      toast(`Failed to install ${modelToInstall}. ${errorMessage}`);
    } finally {
      setIsInstalling(false);
      setInstallProgress(null);
    }
  };

  const handleUpdateModel = async (modelName: string) => {
    try {
      setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'updating' } : m)));

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

      let lastTime = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if ('status' in data) {
              const currentTime = Date.now();
              const timeDiff = (currentTime - lastTime) / 1000;
              const bytesDiff = (data.completed || 0) - lastBytes;
              const speed = bytesDiff / timeDiff;

              setInstallProgress({
                status: data.status,
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

      toast(`Successfully updated ${modelName}`);

      // Refresh model list after update
      await checkInstalledModels();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error updating ${modelName}:`, errorMessage);
      toast(`Failed to update ${modelName}. ${errorMessage}`);
      setModels((prev) => prev.map((m) => (m.name === modelName ? { ...m, status: 'error' } : m)));
    } finally {
      setInstallProgress(null);
    }
  };

  const handleUninstallModel = async (modelName: string) => {
    try {
      setIsInstalling(true);

      const baseUrl = providers?.Ollama?.settings?.baseUrl || 'http://127.0.0.1:11434';

      // Call the Ollama API to delete the model
      const response = await fetch(`${baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to uninstall model: ${error}`);
      }

      toast(`Successfully uninstalled ${modelName}`);

      // Refresh the list of installed models
      checkInstalledModels();
      onModelInstalled();
    } catch (error) {
      console.error('Error uninstalling model:', error);
      toast(`Error uninstalling model: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const allTags = Array.from(new Set(POPULAR_MODELS.flatMap((model) => model.tags)));

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      searchQuery === '' ||
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => model.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <OllamaIcon className="w-7 h-7 text-purple-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-bolt-elements-textPrimary">Ollama Model Hub</h3>
            <p className="text-sm text-bolt-elements-textSecondary">Install and manage your Ollama models</p>
          </div>
        </div>

        <motion.button
          onClick={checkInstalledModels}
          className={cn(
            'rounded-lg px-3 py-2',
            'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary text-sm',
            'hover:bg-bolt-elements-background-depth-4 hover:text-bolt-elements-textPrimary',
            'border border-bolt-elements-borderColor',
            'transition-all duration-200',
            'flex items-center gap-2',
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiRefreshCw className="w-4 h-4" />
          Refresh Models
        </motion.button>
      </div>

      {/* Installation Progress */}
      {installProgress && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-bolt-elements-textPrimary">{installProgress.status}</div>
            <div className="text-xs text-bolt-elements-textSecondary">
              {installProgress.downloadedSize && installProgress.totalSize
                ? `${installProgress.downloadedSize} / ${installProgress.totalSize}`
                : ''}
              {installProgress.speed && <span className="ml-2">{installProgress.speed}</span>}
            </div>
          </div>
          <Progress value={installProgress.progress} className="h-2" />
        </motion.div>
      )}

      {/* Search and Install */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Input
              className="pl-10 pr-4 py-3 h-auto"
              placeholder="Search models or enter custom model name..."
              value={searchQuery || modelString}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setModelString(value);
              }}
              disabled={isInstalling}
            />
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary w-5 h-5" />
            <p className="text-sm text-bolt-elements-textSecondary mt-1.5 px-1">
              Browse models at{' '}
              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:underline inline-flex items-center gap-1"
              >
                ollama.com/library
                <FiExternalLink className="w-3.5 h-3.5" />
              </a>
            </p>
          </div>
          <Button
            onClick={() => handleInstallModel(modelString)}
            disabled={!modelString || isInstalling}
            className="h-auto py-3 px-4"
          >
            {isInstalling ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4">
                  <FiRefreshCw className="w-4 h-4" />
                </div>
                <span>Installing...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FiDownload className="w-4 h-4" />
                <span>Install Model</span>
              </div>
            )}
          </Button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 py-2">
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer',
                selectedTags.includes(tag)
                  ? 'bg-purple-500 hover:bg-purple-600'
                  : 'hover:bg-bolt-elements-background-depth-3',
              )}
              onClick={() => {
                setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Models List */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Models</TabsTrigger>
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="updates">Updates Available</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-2">
          {filteredModels.length === 0 ? (
            <div className="text-center py-8 text-bolt-elements-textSecondary">
              No models found. Try adjusting your search or filters.
            </div>
          ) : (
            filteredModels.map((model) => (
              <motion.div
                key={model.name}
                className={cn(
                  'p-4 rounded-xl',
                  'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                  'hover:border-purple-500/30',
                  'transition-all duration-200',
                  'relative group',
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <OllamaIcon className="w-5 h-5 text-purple-500" />
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-bolt-elements-textPrimary font-medium">{model.name}</p>
                        <p className="text-sm text-bolt-elements-textSecondary mt-0.5">{model.desc}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {model.size}
                        </Badge>
                        {model.installedVersion && (
                          <div className="mt-1.5 flex flex-col items-end gap-0.5">
                            <span className="text-xs text-bolt-elements-textTertiary">v{model.installedVersion}</span>
                            {model.needsUpdate && model.latestVersion && (
                              <span className="text-xs text-purple-500 flex items-center gap-1">
                                <FiArrowUp className="w-3 h-3" />v{model.latestVersion} available
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {model.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      {model.installedVersion ? (
                        model.needsUpdate ? (
                          <Button size="sm" onClick={() => handleUpdateModel(model.name)} className="h-8">
                            <FiArrowUp className="w-3.5 h-3.5 mr-1.5" />
                            Update
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUninstallModel(model.name)}
                            className="text-red-500 hover:text-red-600 h-8 border-red-200 dark:border-red-800/30 hover:border-red-300"
                          >
                            <FiTrash2 className="w-3.5 h-3.5 mr-1.5" />
                            Uninstall
                          </Button>
                        )
                      ) : (
                        <Button size="sm" onClick={() => handleInstallModel(model.name)} className="h-8">
                          <FiDownload className="w-3.5 h-3.5 mr-1.5" />
                          Install
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="installed" className="space-y-3 mt-2">
          {filteredModels.filter((m) => m.installedVersion).length === 0 ? (
            <div className="text-center py-8 text-bolt-elements-textSecondary">
              No installed models found. Install a model to see it here.
            </div>
          ) : (
            filteredModels
              .filter((m) => m.installedVersion)
              .map((model) => (
                <motion.div
                  key={model.name}
                  className={cn(
                    'p-4 rounded-xl',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'hover:border-purple-500/30',
                    'transition-all duration-200',
                    'relative group',
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Same content as above */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <OllamaIcon className="w-5 h-5 text-purple-500" />
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-bolt-elements-textPrimary font-medium">{model.name}</p>
                          <p className="text-sm text-bolt-elements-textSecondary mt-0.5">{model.desc}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="font-mono">
                            {model.size}
                          </Badge>
                          {model.installedVersion && (
                            <div className="mt-1.5 flex flex-col items-end gap-0.5">
                              <span className="text-xs text-bolt-elements-textTertiary">v{model.installedVersion}</span>
                              {model.needsUpdate && model.latestVersion && (
                                <span className="text-xs text-purple-500 flex items-center gap-1">
                                  <FiArrowUp className="w-3 h-3" />v{model.latestVersion} available
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {model.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        {model.needsUpdate ? (
                          <Button size="sm" onClick={() => handleUpdateModel(model.name)} className="h-8">
                            <FiArrowUp className="w-3.5 h-3.5 mr-1.5" />
                            Update
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUninstallModel(model.name)}
                            className="text-red-500 hover:text-red-600 h-8 border-red-200 dark:border-red-800/30 hover:border-red-300"
                          >
                            <FiTrash2 className="w-3.5 h-3.5 mr-1.5" />
                            Uninstall
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
          )}
        </TabsContent>

        <TabsContent value="updates" className="space-y-3 mt-2">
          {filteredModels.filter((m) => m.needsUpdate).length === 0 ? (
            <div className="text-center py-8 text-bolt-elements-textSecondary">
              No updates available. All installed models are up to date.
            </div>
          ) : (
            filteredModels
              .filter((m) => m.needsUpdate)
              .map((model) => (
                <motion.div
                  key={model.name}
                  className={cn(
                    'p-4 rounded-xl',
                    'bg-bolt-elements-background-depth-2 border border-purple-500/20',
                    'hover:border-purple-500/30',
                    'transition-all duration-200',
                    'relative group',
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Same content as above */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <OllamaIcon className="w-5 h-5 text-purple-500" />
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-bolt-elements-textPrimary font-medium">{model.name}</p>
                          <p className="text-sm text-bolt-elements-textSecondary mt-0.5">{model.desc}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="font-mono">
                            {model.size}
                          </Badge>
                          {model.installedVersion && (
                            <div className="mt-1.5 flex flex-col items-end gap-0.5">
                              <span className="text-xs text-bolt-elements-textTertiary">v{model.installedVersion}</span>
                              {model.needsUpdate && model.latestVersion && (
                                <span className="text-xs text-purple-500 flex items-center gap-1">
                                  <FiArrowUp className="w-3 h-3" />v{model.latestVersion} available
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {model.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" onClick={() => handleUpdateModel(model.name)} className="h-8">
                          <FiArrowUp className="w-3.5 h-3.5 mr-1.5" />
                          Update
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
