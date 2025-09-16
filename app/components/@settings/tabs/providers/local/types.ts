// Type definitions
import type { ComponentType } from 'react';
import { Server, Monitor, Globe } from 'lucide-react';

export type ProviderName = 'Ollama' | 'LMStudio' | 'OpenAILike' | 'DockerModelRunner';

export interface OllamaModel {
  name: string;
  digest: string;
  size: number;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
  status?: 'idle' | 'updating' | 'updated' | 'error' | 'checking';
  error?: string;
  newDigest?: string;
  progress?: {
    current: number;
    total: number;
    status: string;
  };
}

export interface LMStudioModel {
  id: string;
  object: 'model';
  owned_by: string;
  created?: number;
}

// Constants
export const OLLAMA_API_URL = 'http://127.0.0.1:11434';

export const PROVIDER_ICONS: Record<ProviderName, ComponentType<any>> = {
  Ollama: Server,
  LMStudio: Monitor,
  OpenAILike: Globe,
  DockerModelRunner: Server,
} as const;

export const PROVIDER_DESCRIPTIONS = {
  Ollama: 'Run open-source models locally on your machine',
  LMStudio: 'Local model inference with LM Studio',
  OpenAILike: 'Connect to OpenAI-compatible API endpoints',
  DockerModelRunner: 'Docker Desktop Model Runner with OpenAI-compatible API (/engines/v1)',
} as const;
