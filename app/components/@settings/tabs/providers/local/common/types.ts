import type { IconType } from 'react-icons';
import type { ComponentType } from 'react';

/**
 * Provider key type
 */
export type ProviderKey = 'Ollama' | 'LMStudio' | 'OpenAILike';

/**
 * Provider settings interface
 */
export interface ProviderSettings {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Provider descriptions
 */
export const PROVIDER_DESCRIPTIONS: Record<ProviderKey, string> = {
  Ollama: 'Run open-source large language models locally on your machine',
  LMStudio: 'Run and fine-tune models with a user-friendly interface',
  OpenAILike: 'Connect to any API that implements the OpenAI API spec',
};

/**
 * Default provider URLs
 */
export const PROVIDER_DEFAULT_URLS: Record<ProviderKey, string> = {
  Ollama: 'http://localhost:11434',
  LMStudio: 'http://localhost:1234',
  OpenAILike: 'http://localhost:8080',
};

/**
 * Model info interface
 */
export interface ModelInfo {
  name: string;
  desc?: string;
  size?: string;
  tags?: string[];
  installed?: boolean;
}

/**
 * Install progress interface
 */
export interface InstallProgress {
  status: string;
  total: number;
  completed: number;
  percent: number;
  speed: string;
  totalSize?: string;
}

/**
 * Common types
 */
export interface CommonTypes {
  InstallProgress: InstallProgress;
}

/**
 * Ollama model interface
 */
export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

/**
 * Ollama pull response interface
 */
export interface OllamaPullResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  progress?: number;
}

/**
 * LM Studio model interface
 */
export interface LMStudioModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * OpenAI-like model interface
 */
export interface OpenAILikeModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * Provider configuration interface
 */
export interface IProviderConfig {
  name: string;
  settings: {
    enabled: boolean;
    baseUrl: string;
    apiKey?: string;
    [key: string]: any;
  };
  staticModels: any[];
  getDynamicModels?: () => Promise<any[]>;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: IconType;
}

/**
 * Provider with settings
 */
export interface Provider {
  key: ProviderKey;
  settings: ProviderSettings;
}

/**
 * API client interface
 */
export interface ApiClient {
  isServerRunning(): Promise<boolean>;
  getModels(): Promise<ModelInfo[]>;
}

/**
 * Provider registry entry
 */
export interface ProviderRegistryEntry {
  key: ProviderKey;
  name: string;
  icon: IconType | React.FC<{ className?: string }>;
  description: string;
  defaultSettings: ProviderSettings;
  component: () => Promise<ComponentType>;
  apiClient: () => Promise<ApiClient>;
}
