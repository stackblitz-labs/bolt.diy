import type { LanguageModelV1 } from 'ai';
import type { ProviderInfo, ProviderConfig, ModelInfo } from './types';
import type { IProviderSetting } from '~/types/model';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMManager } from './manager';
import {
  applyMiddleware,
  modelSupportsReasoning,
  modelSupportsImageGeneration,
  modelSupportsStructuredOutput,
  modelSupportsCodeDiff,
} from './middleware';

export abstract class BaseProvider implements ProviderInfo {
  abstract name: string;
  abstract staticModels: ModelInfo[];
  abstract config: ProviderConfig;
  cachedDynamicModels?: {
    cacheId: string;
    models: ModelInfo[];
  };

  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;

  getProviderBaseUrlAndKey(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: IProviderSetting;
    serverEnv?: Record<string, string>;
    defaultBaseUrlKey: string;
    defaultApiTokenKey: string;
  }) {
    const { apiKeys, providerSettings, serverEnv, defaultBaseUrlKey, defaultApiTokenKey } = options;
    let settingsBaseUrl = providerSettings?.baseUrl;
    const manager = LLMManager.getInstance();

    if (settingsBaseUrl && settingsBaseUrl.length == 0) {
      settingsBaseUrl = undefined;
    }

    const baseUrlKey = this.config.baseUrlKey || defaultBaseUrlKey;
    let baseUrl =
      settingsBaseUrl ||
      serverEnv?.[baseUrlKey] ||
      process?.env?.[baseUrlKey] ||
      manager.env?.[baseUrlKey] ||
      this.config.baseUrl;

    if (baseUrl && baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const apiTokenKey = this.config.apiTokenKey || defaultApiTokenKey;
    const apiKey =
      apiKeys?.[this.name] || serverEnv?.[apiTokenKey] || process?.env?.[apiTokenKey] || manager.env?.[apiTokenKey];

    return {
      baseUrl,
      apiKey,
    };
  }

  // Method to get the model with appropriate middleware applied
  getModelWithMiddleware(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    // Get the base model instance
    const baseModel = this.getModelInstance(options);

    // Find the model info to check features
    const modelInfo = this.findModelInfo(options.model);

    // Apply middleware based on model features
    return applyMiddleware(baseModel, modelInfo);
  }

  // Helper to find model info for a given model name
  findModelInfo(modelName: string): ModelInfo {
    // Check static models first
    const staticModel = this.staticModels.find((model) => model.name === modelName);

    if (staticModel) {
      return staticModel;
    }

    // Check dynamic models if available
    if (this.cachedDynamicModels?.models) {
      const dynamicModel = this.cachedDynamicModels.models.find((model) => model.name === modelName);

      if (dynamicModel) {
        return dynamicModel;
      }
    }

    // If model not found, create a basic model info with auto-detected features
    return {
      name: modelName,
      label: modelName,
      provider: this.name,
      maxTokenAllowed: 8000,
      features: {
        reasoning: modelSupportsReasoning(modelName),
        imageGeneration: modelSupportsImageGeneration(modelName),
        structuredOutput: modelSupportsStructuredOutput(modelName),
        codeDiff: modelSupportsCodeDiff(modelName),
      },
    };
  }

  getModelsFromCache(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  }): ModelInfo[] | null {
    if (!this.cachedDynamicModels) {
      // console.log('no dynamic models',this.name);
      return null;
    }

    const cacheKey = this.cachedDynamicModels.cacheId;
    const generatedCacheKey = this.getDynamicModelsCacheKey(options);

    if (cacheKey !== generatedCacheKey) {
      // console.log('cache key mismatch',this.name,cacheKey,generatedCacheKey);
      this.cachedDynamicModels = undefined;
      return null;
    }

    return this.cachedDynamicModels.models;
  }
  getDynamicModelsCacheKey(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
    serverEnv?: Record<string, string>;
  }) {
    return JSON.stringify({
      apiKeys: options.apiKeys?.[this.name],
      providerSettings: options.providerSettings?.[this.name],
      serverEnv: options.serverEnv,
    });
  }
  storeDynamicModels(
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
      serverEnv?: Record<string, string>;
    },
    models: ModelInfo[],
  ) {
    // Enhance dynamic models with auto-detected capabilities
    const enhancedModels = models.map((model) => ({
      ...model,
      features: {
        ...model.features,
        reasoning: model.features?.reasoning || modelSupportsReasoning(model.name),
        imageGeneration: model.features?.imageGeneration || modelSupportsImageGeneration(model.name),
        structuredOutput: model.features?.structuredOutput || modelSupportsStructuredOutput(model.name),
        codeDiff: model.features?.codeDiff || modelSupportsCodeDiff(model.name),
      },
    }));

    const cacheId = this.getDynamicModelsCacheKey(options);

    // console.log('caching dynamic models',this.name,cacheId);
    this.cachedDynamicModels = {
      cacheId,
      models: enhancedModels,
    };
  }

  // Declare the optional getDynamicModels method
  getDynamicModels?(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]>;

  abstract getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1;
}

type OptionalApiKey = string | undefined;

export function getOpenAILikeModel(baseURL: string, apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });

  return openai(model);
}
