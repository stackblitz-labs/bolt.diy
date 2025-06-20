import type { IconType } from 'react-icons';

export type ProviderName =
  | 'AmazonBedrock'
  | 'Cohere'
  | 'Deepseek'
  | 'Google'
  | 'Groq'
  | 'HuggingFace'
  | 'Hyperbolic'
  | 'Mistral'
  | 'OpenRouter'
  | 'Perplexity'
  | 'Together'
  | 'XAI';

export type ServiceStatus = {
  provider: ProviderName;
  status: 'operational' | 'degraded' | 'down';
  lastChecked: string;
  statusUrl?: string;
  icon?: IconType;
  message?: string;
  responseTime?: number;
  incidents?: string[];
};

export interface ProviderConfig {
  statusUrl: string;
  apiUrl: string;
  headers: Record<string, string>;
  testModel: string;
}

export type ApiResponse = {
  error?: {
    message: string;
  };
  message?: string;
  model?: string;
  models?: Array<{
    id?: string;
    name?: string;
  }>;
  data?: Array<{
    id?: string;
    name?: string;
  }>;
};

export type StatusCheckResult = {
  status: 'operational' | 'degraded' | 'down';
  message: string;
  incidents: string[];
};
