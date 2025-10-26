import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class ZaiProvider extends BaseProvider {
  name = 'Zai';
  getApiKeyLink = 'https://docs.z.ai/guides/llm/getting-api-keys';
  labelForGetApiKey = 'Get Zai API Key';

  config = {
    apiTokenKey: 'ZAI_API_KEY',
    baseUrlKey: 'ZAI_API_BASE_URL',
    baseUrl: 'https://api.z.ai/api/paas/v4',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'glm-4.6',
      label: 'GLM-4.6',
      provider: 'Zai',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 128000,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ZAI_API_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    // Use OpenAI-compatible interface since Zai follows OpenAI API format
    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}