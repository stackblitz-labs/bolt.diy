import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { LLMManager } from './manager';
import type { ModelInfo, ProviderConfig, ProviderInfo } from './types';

export abstract class BaseProvider implements ProviderInfo {
  abstract name: string;
  abstract staticModels: ModelInfo[];
  abstract config: ProviderConfig;
  cachedDynamicModels?: {
    cacheId: string;
    models: ModelInfo[];
  };
  supportsManagedIdentity?: boolean | undefined;
  getToken?: () => Promise<string> | undefined;

  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;

  getInterceptor():
    | ((request: RequestInfo | URL, init?: RequestInit<RequestInitCfProperties>) => Promise<Response>)
    | undefined {
    if (!this.getToken) {
      return undefined;
    }

    return async (request: RequestInfo | URL, init?: RequestInit<RequestInitCfProperties>): Promise<Response> => {
      if (!this.getToken) {
        throw new Error("getToken is not defined in the provider's instance");
      }

      const token = await this.getToken();

      const allHeaders: Headers = new Headers({
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      });
      allHeaders.delete('api-key');

      return fetch(request, {
        ...init,
        headers: allHeaders,
      });
    };
  }

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
    const cacheId = this.getDynamicModelsCacheKey(options);

    // console.log('caching dynamic models',this.name,cacheId);
    this.cachedDynamicModels = {
      cacheId,
      models,
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
