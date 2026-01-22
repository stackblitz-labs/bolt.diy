import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class ZaiProvider extends BaseProvider {
  name = 'Zai';
  getApiKeyLink = 'https://open.bigmodel.cn/usercenter/apikeys';

  config = {
    baseUrl: 'https://api.z.ai/api/paas/v4/',
    apiTokenKey: 'ZAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models - only the most stable/reliable ones
     * GLM-4.7: Latest flagship model with 128k context
     */
    { name: 'glm-4.7', label: 'GLM-4.7', provider: 'Zai', maxTokenAllowed: 128000, maxCompletionTokens: 4096 },

    // GLM-4.7-FlashX: Fast variant with 128k context
    {
      name: 'glm-4.7-flashx',
      label: 'GLM-4.7 FlashX',
      provider: 'Zai',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },

    // GLM-4.7-Flash: Fast variant with 128k context
    {
      name: 'glm-4.7-flash',
      label: 'GLM-4.7 Flash',
      provider: 'Zai',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },

    // GLM-4.6: Flagship model with 128k context
    { name: 'glm-4.6', label: 'GLM-4.6', provider: 'Zai', maxTokenAllowed: 128000, maxCompletionTokens: 4096 },

    // GLM-4.5: Flagship model with 128k context
    { name: 'glm-4.5', label: 'GLM-4.5', provider: 'Zai', maxTokenAllowed: 128000, maxCompletionTokens: 4096 },

    // GLM-4.5-Air: Cost-effective variant with 128k context
    {
      name: 'glm-4.5-air',
      label: 'GLM-4.5 Air',
      provider: 'Zai',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },

    // GLM-4-Air: Older but capable model with 128k context
    { name: 'glm-4-air', label: 'GLM-4 Air', provider: 'Zai', maxTokenAllowed: 128000, maxCompletionTokens: 4096 },

    // GLM-4-Flash: Fast variant with 128k context
    { name: 'glm-4-flash', label: 'GLM-4 Flash', provider: 'Zai', maxTokenAllowed: 128000, maxCompletionTokens: 4096 },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ZAI_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`${baseUrl}models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${this.name}: ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    // Filter models that are chat/completion models and not in static list
    const data = (res.data || []).filter(
      (model: any) => model.id?.startsWith('glm') && !staticModelIds.includes(model.id) && model.object === 'model',
    );

    return data.map((m: any) => {
      // Default context window for GLM models
      const contextWindow = 128000;

      return {
        name: m.id,
        label: `${m.id}`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens: 4096,
      };
    });
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ZAI_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey,
    });

    return openai(model);
  }
}
