export interface ModelInfo {
  name: string;
  label: string;
  provider: string;
  maxTokenAllowed: number;
  features?: {
    reasoning?: boolean;
    imageGeneration?: boolean;
    structuredOutput?: boolean;
    codeDiff?: boolean;
  };
}

export interface ProviderInfo {
  name: string;
  staticModels: ModelInfo[];
  config: ProviderConfig;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;
  getDynamicModels?(
    apiKeys?: Record<string, string>,
    settings?: Record<string, any>,
    serverEnv?: Record<string, any>,
  ): Promise<ModelInfo[]>;
}

export interface ProviderConfig {
  baseUrlKey?: string;
  apiTokenKey?: string;
  baseUrl?: string;
}
