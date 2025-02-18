import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { Progress } from '~/components/ui/Progress';
import { useToast } from '~/components/ui/use-toast';
import { useSettings } from '~/lib/hooks/useSettings';

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
  const [isChecking, setIsChecking] = useState(false);
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

  // Check installed models on mount and after installation
  useEffect(() => {
    checkInstalledModels();
  }, [baseUrl]);

  const handleCheckUpdates = async () => {
    setIsChecking(true);

    try {
      await checkInstalledModels();
      toast('Model versions checked');
    } catch (err) {
      console.error('Failed to check model versions:', err);
      toast('Failed to check model versions');
    } finally {
      setIsChecking(false);
    }
  };

  const filteredModels = models.filter((model) => {
    const matchesSearch =
      searchQuery === '' ||
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.desc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => model.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

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

      toast('Successfully installed ' + modelToInstall + '. The model list will refresh automatically.');

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

  const handleUpdateModel = async (modelToUpdate: string) => {
    try {
      setModels((prev) => prev.map((m) => (m.name === modelToUpdate ? { ...m, status: 'updating' } : m)));

      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelToUpdate }),
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

      toast('Successfully updated ' + modelToUpdate);

      // Refresh model list after update
      await checkInstalledModels();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`Error updating ${modelToUpdate}:`, errorMessage);
      toast(`Failed to update ${modelToUpdate}. ${errorMessage}`);
      setModels((prev) => prev.map((m) => (m.name === modelToUpdate ? { ...m, status: 'error' } : m)));
    } finally {
      setInstallProgress(null);
    }
  };

  const allTags = Array.from(new Set(POPULAR_MODELS.flatMap((model) => model.tags)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-6">
        <div className="flex items-center gap-3">
          <OllamaIcon className="w-8 h-8 text-purple-500" />
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Ollama Models</h3>
            <p className="text-sm text-bolt-elements-textSecondary mt-1">Install and manage your Ollama models</p>
          </div>
        </div>
        <motion.button
          onClick={handleCheckUpdates}
          disabled={isChecking}
          className={classNames(
            'px-4 py-2 rounded-lg',
            'bg-purple-500/10 text-purple-500',
            'hover:bg-purple-500/20',
            'transition-all duration-200',
            'flex items-center gap-2',
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isChecking ? (
            <div className="i-ph:spinner-gap-bold animate-spin" />
          ) : (
            <div className="i-ph:arrows-clockwise" />
          )}
          Check Updates
        </motion.button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="space-y-1">
            <input
              type="text"
              className={classNames(
                'w-full px-4 py-3 rounded-xl',
                'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                'transition-all duration-200',
              )}
              placeholder="Search models or enter custom model name..."
              value={searchQuery || modelString}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setModelString(value);
              }}
              disabled={isInstalling}
            />
            <p className="text-sm text-bolt-elements-textSecondary px-1">
              Browse models at{' '}
              <a
                href="https://ollama.com/library"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-500 hover:underline inline-flex items-center gap-1 text-base font-medium"
              >
                ollama.com/library
                <div className="i-ph:arrow-square-out text-sm" />
              </a>{' '}
              and copy model names to install
            </p>
          </div>
        </div>
        <motion.button
          onClick={() => handleInstallModel(modelString)}
          disabled={!modelString || isInstalling}
          className={classNames(
            'rounded-lg px-4 py-2',
            'bg-purple-500 text-white text-sm',
            'hover:bg-purple-600',
            'transition-all duration-200',
            'flex items-center gap-2',
            { 'opacity-50 cursor-not-allowed': !modelString || isInstalling },
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isInstalling ? (
            <div className="flex items-center gap-2">
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
              <span>Installing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <OllamaIcon className="w-4 h-4" />
              <span>Install Model</span>
            </div>
          )}
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => {
              setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
            }}
            className={classNames(
              'px-3 py-1 rounded-full text-xs font-medium transition-all duration-200',
              selectedTags.includes(tag)
                ? 'bg-purple-500 text-white'
                : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4',
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filteredModels.map((model) => (
          <motion.div
            key={model.name}
            className={classNames(
              'flex items-start gap-2 p-3 rounded-lg',
              'bg-bolt-elements-background-depth-3',
              'hover:bg-bolt-elements-background-depth-4',
              'transition-all duration-200',
              'relative group',
            )}
          >
            <OllamaIcon className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-bolt-elements-textPrimary font-mono text-sm">{model.name}</p>
                  <p className="text-xs text-bolt-elements-textSecondary mt-0.5">{model.desc}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-bolt-elements-textTertiary">{model.size}</span>
                  {model.installedVersion && (
                    <div className="mt-0.5 flex flex-col items-end gap-0.5">
                      <span className="text-xs text-bolt-elements-textTertiary">v{model.installedVersion}</span>
                      {model.needsUpdate && model.latestVersion && (
                        <span className="text-xs text-purple-500">v{model.latestVersion} available</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {model.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded-full text-[10px] bg-bolt-elements-background-depth-4 text-bolt-elements-textTertiary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {model.installedVersion ? (
                    model.needsUpdate ? (
                      <motion.button
                        onClick={() => handleUpdateModel(model.name)}
                        className={classNames(
                          'px-2 py-0.5 rounded-lg text-xs',
                          'bg-purple-500 text-white',
                          'hover:bg-purple-600',
                          'transition-all duration-200',
                          'flex items-center gap-1',
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="i-ph:arrows-clockwise text-xs" />
                        Update
                      </motion.button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg text-xs text-green-500 bg-green-500/10">Up to date</span>
                    )
                  ) : (
                    <motion.button
                      onClick={() => handleInstallModel(model.name)}
                      className={classNames(
                        'px-2 py-0.5 rounded-lg text-xs',
                        'bg-purple-500 text-white',
                        'hover:bg-purple-600',
                        'transition-all duration-200',
                        'flex items-center gap-1',
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="i-ph:download text-xs" />
                      Install
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {installProgress && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-bolt-elements-textSecondary">{installProgress.status}</span>
            <div className="flex items-center gap-4">
              <span className="text-bolt-elements-textTertiary">
                {installProgress.downloadedSize} / {installProgress.totalSize}
              </span>
              <span className="text-bolt-elements-textTertiary">{installProgress.speed}</span>
              <span className="text-bolt-elements-textSecondary">{Math.round(installProgress.progress)}%</span>
            </div>
          </div>
          <Progress value={installProgress.progress} className="h-1" />
        </motion.div>
      )}
    </div>
  );
}
