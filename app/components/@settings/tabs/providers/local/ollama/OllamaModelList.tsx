import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Badge } from '~/components/ui/Badge';
import { useToast } from '~/components/ui/use-toast';
import OllamaModelCard from './OllamaModelCard';
import { OllamaApiClient } from './api';
import type { ModelInfo, InstallProgress } from '~/components/@settings/tabs/providers/local/common/types';
import OllamaInstallProgress from './OllamaInstallProgress';
import { cn } from '~/utils/classNames';

// Popular models to show by default
const POPULAR_MODELS: ModelInfo[] = [
  {
    name: 'llama3',
    desc: "Meta's Llama 3 8B model, optimized for helpful and safe chat",
    size: '4.7 GB',
    tags: ['popular', 'chat', 'small'],
  },
  {
    name: 'llama3:8b',
    desc: "Meta's Llama 3 8B model, optimized for helpful and safe chat",
    size: '4.7 GB',
    tags: ['popular', 'chat', 'small'],
  },
  {
    name: 'llama3:70b',
    desc: "Meta's Llama 3 70B model, optimized for helpful and safe chat",
    size: '39 GB',
    tags: ['popular', 'chat', 'large'],
  },
  {
    name: 'codellama',
    desc: "Meta's Llama 2 code model, fine-tuned for code completion and generation",
    size: '7.5 GB',
    tags: ['popular', 'coding'],
  },
  {
    name: 'codellama:7b',
    desc: "Meta's Llama 2 7B code model, fine-tuned for code completion and generation",
    size: '3.8 GB',
    tags: ['popular', 'coding', 'small'],
  },
  {
    name: 'codellama:13b',
    desc: "Meta's Llama 2 13B code model, fine-tuned for code completion and generation",
    size: '7.5 GB',
    tags: ['popular', 'coding', 'medium'],
  },
  {
    name: 'mistral',
    desc: 'Mistral 7B model, a strong base model for various tasks',
    size: '4.1 GB',
    tags: ['popular', 'chat', 'small'],
  },
  {
    name: 'mistral:7b-instruct-v0.2',
    desc: 'Mistral 7B instruction-tuned model, optimized for chat',
    size: '4.1 GB',
    tags: ['popular', 'chat', 'small'],
  },
  {
    name: 'mixtral',
    desc: 'Mixtral 8x7B, a powerful mixture-of-experts model',
    size: '26 GB',
    tags: ['popular', 'chat', 'large'],
  },
  {
    name: 'mixtral:8x7b-instruct-v0.1',
    desc: 'Mixtral 8x7B instruction-tuned model, optimized for chat',
    size: '26 GB',
    tags: ['popular', 'chat', 'large'],
  },
  {
    name: 'phi',
    desc: "Microsoft's Phi-2 model, small but powerful",
    size: '2.7 GB',
    tags: ['popular', 'chat', 'small'],
  },
  {
    name: 'phi:2.7b',
    desc: "Microsoft's Phi-2 model, small but powerful",
    size: '2.7 GB',
    tags: ['popular', 'chat', 'small'],
  },
];

// Extend ModelInfo with installed status
interface OllamaModelWithStatus extends ModelInfo {
  installed: boolean;
}

interface OllamaModelListProps {
  baseUrl: string;
  onModelInstalled?: () => void;
}

export default function OllamaModelList({ baseUrl, onModelInstalled }: OllamaModelListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [modelToInstall, setModelToInstall] = useState<string | null>(null);
  const [customModelName, setCustomModelName] = useState('');
  const { toast } = useToast();

  // Fetch installed models on mount
  useEffect(() => {
    fetchInstalledModels();
  }, [baseUrl]);

  // Fetch installed models from Ollama API
  const fetchInstalledModels = async () => {
    if (!baseUrl) {
      return;
    }

    setIsLoadingModels(true);

    try {
      const apiClient = new OllamaApiClient(baseUrl);
      const models = await apiClient.getModels();
      setInstalledModels(models);
    } catch (error) {
      console.error('Error fetching installed models:', error);
      setInstalledModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Install a model
  const installModel = async (modelName: string) => {
    if (!baseUrl || isInstalling) {
      return;
    }

    setIsInstalling(true);
    setModelToInstall(modelName);
    setInstallProgress(null);

    try {
      const apiClient = new OllamaApiClient(baseUrl);

      // Progress callback
      const onProgress = (progress: number) => {
        setInstallProgress({
          status: 'Installing...',
          total: 100,
          completed: progress,
          percent: progress,
          speed: '',
        });
      };

      // Start installation
      await apiClient.pullModel(modelName, onProgress);

      // Refresh installed models
      await fetchInstalledModels();

      // Notify parent component
      if (onModelInstalled) {
        onModelInstalled();
      }

      // Show success toast
      toast(`${modelName} has been installed and is ready to use.`, { type: 'success' });
    } catch (error) {
      console.error(`Error installing model ${modelName}:`, error);

      // Show error toast
      toast(`Failed to install model ${modelName}: ${error instanceof Error ? error.message : String(error)}`, {
        type: 'error',
      });
    } finally {
      setIsInstalling(false);
      setModelToInstall(null);
      setInstallProgress(null);
    }
  };

  // Delete a model
  const deleteModel = async (modelName: string) => {
    if (!baseUrl || isInstalling) {
      return;
    }

    try {
      const apiClient = new OllamaApiClient(baseUrl);
      await apiClient.deleteModel(modelName);

      // Refresh installed models
      await fetchInstalledModels();

      // Notify parent component
      if (onModelInstalled) {
        onModelInstalled();
      }

      // Show success toast
      toast(`${modelName} has been removed.`, { type: 'success' });
    } catch (error) {
      console.error(`Error deleting model ${modelName}:`, error);

      // Show error toast
      toast(`Failed to delete model ${modelName}: ${error instanceof Error ? error.message : String(error)}`, {
        type: 'error',
      });
    }
  };

  // Filter models based on search term and selected tag
  const getFilteredModels = (allModels: ModelInfo[], installedModels: ModelInfo[]): OllamaModelWithStatus[] => {
    // Combine the model lists and mark installed status
    const modelsWithStatus = allModels.map((model) => ({
      ...model,
      installed: installedModels.some((m) => m.name === model.name),
      desc: model.desc || '', // Ensure desc is never undefined
    })) as OllamaModelWithStatus[];

    // Apply filters
    return modelsWithStatus.filter((model) => {
      const matchesSearch =
        searchTerm === '' ||
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (model.desc?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      const matchesTag = selectedTag === null || (model.tags && model.tags.includes(selectedTag));

      return matchesSearch && matchesTag;
    });
  };

  // Handle custom model installation
  const handleCustomModelInstall = () => {
    if (!customModelName.trim()) {
      toast('Please enter a model name to install.', { type: 'error' });
      return;
    }

    installModel(customModelName.trim());
    setCustomModelName('');
  };

  // Get all unique tags from models
  const getAllTags = () => {
    const tags = new Set<string>();

    POPULAR_MODELS.forEach((model) => {
      model.tags?.forEach((tag) => tags.add(tag));
    });

    return Array.from(tags);
  };

  const filteredModels = getFilteredModels(POPULAR_MODELS, installedModels);
  const allTags = getAllTags();

  return (
    <div className="space-y-4">
      {/* Search and filter */}
      <div className="space-y-3">
        <Input
          placeholder="Search models..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedTag === null ? 'default' : 'outline'}
            className={cn('cursor-pointer', selectedTag === null ? 'bg-purple-500' : '')}
            onClick={() => setSelectedTag(null)}
          >
            All
          </Badge>

          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? 'default' : 'outline'}
              className={cn('cursor-pointer', selectedTag === tag ? 'bg-purple-500' : '')}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Custom model installation */}
      <div className="p-3 rounded-lg bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Install Custom Model</h4>
        <div className="flex gap-2">
          <Input
            placeholder="Enter model name (e.g., llama3:8b)"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCustomModelInstall();
              }
            }}
          />
          <Button onClick={handleCustomModelInstall} disabled={isInstalling || !customModelName.trim()}>
            Install
          </Button>
        </div>
      </div>

      {/* Installation progress */}
      <AnimatePresence>
        {isInstalling && installProgress && <OllamaInstallProgress progress={installProgress} />}
      </AnimatePresence>

      {/* Model list */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
          {isLoadingModels ? 'Loading models...' : `${filteredModels.length} models available`}
        </h4>

        {isLoadingModels ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 w-full bg-bolt-elements-background-depth-3 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="text-center py-6 text-bolt-elements-textSecondary">
            <div className="i-ph:cube-transparent text-4xl mx-auto mb-2" />
            <p>No models found matching your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredModels.map((model: OllamaModelWithStatus) => (
              <OllamaModelCard
                key={model.name}
                model={model}
                onInstall={() => installModel(model.name)}
                onDelete={() => deleteModel(model.name)}
                isInstalling={isInstalling && modelToInstall === model.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
