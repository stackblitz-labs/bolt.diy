import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class ModelScopeProvider extends BaseProvider {
  name = 'ModelScope';
  getApiKeyLink = 'https://modelscope.cn/my/myaccesstoken';

  config = {
    apiTokenKey: 'MODELSCOPE_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Qwen3-14B via ModelScope: 128k context
    {
      name: 'Qwen/Qwen3-14B',
      label: 'Qwen/Qwen3-14B',
      provider: 'ModelScope',
      maxTokenAllowed: 128000,
    },

    // Qwen3-32B via ModelScope: 128k context
    {
      name: 'Qwen/Qwen3-32B',
      label: 'Qwen/Qwen3-32B',
      provider: 'ModelScope',
      maxTokenAllowed: 128000,
    },

    // Qwen/Qwen3-235B-A22B via ModelScope: 128k context
    {
      name: 'Qwen/Qwen3-235B-A22B',
      label: 'Qwen/Qwen3-235B-A22B',
      provider: 'ModelScope',
      maxTokenAllowed: 128000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'MODELSCOPE_API_KEY',
    });
    console.error(`apiKey: ${apiKey}`);

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api-inference.modelscope.cn/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`ModelScope API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      // Filter out models we already have in staticModels
      const dynamicModels =
        data.data
          ?.filter((model: any) => !staticModelIds.includes(model.id))
          .map((m: any) => ({
            name: m.id,
            label: `${m.id} (Dynamic)`,
            provider: this.name,
            maxTokenAllowed: 64000, // Default, adjust per model if available
            maxCompletionTokens: 8192,
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch ModelScope models:`, error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'MODELSCOPE_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: 'https://api-inference.modelscope.cn/v1/',
    });

    return openai(model);
  }
}
