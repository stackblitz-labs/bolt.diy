import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createOpenAI } from '@ai-sdk/openai';

export default class ZAIProvider extends BaseProvider {
  name = 'ZAI';
  getApiKeyLink = 'https://open.bigmodel.cn/usercenter/apikeys';

  config = {
    baseUrlKey: 'ZAI_API_BASE_URL',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    apiTokenKey: 'ZAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'GLM-4.6',
      label: 'Z.ai GLM 4.6',
      provider: 'ZAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

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
      defaultBaseUrlKey: 'ZAI_API_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || this.config.baseUrl,
      apiKey,
    });

    return openai(model);
  }
}
