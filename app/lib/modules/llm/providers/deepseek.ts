import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'deepseek-coder', label: 'Deepseek-Coder', provider: 'Deepseek', maxTokenAllowed: 8000 },
    { name: 'deepseek-chat', label: 'Deepseek-Chat', provider: 'Deepseek', maxTokenAllowed: 8000 },
    { name: 'deepseek-reasoner', label: 'Deepseek-Reasoner', provider: 'Deepseek', maxTokenAllowed: 8000 },
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
      defaultBaseUrlKey: 'DEEPSEEK_BASE_URL',
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    // Create a fetch function that implements timeout
    const timeoutMs = providerSettings?.[this.name]?.timeout || 60000;
    const fetchWithTimeout: typeof fetch = async (url, options) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, {
          ...options,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(id);
      }
    };

    const deepseek = createDeepSeek({
      apiKey,
      baseURL: baseUrl,
      fetch: fetchWithTimeout as any,
    });

    return deepseek(model, {
      // simulateStreaming: true,
    });
  }
}
