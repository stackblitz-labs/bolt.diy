import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai/settings';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'qwen3-coder-480b',
      label: 'Qwen3-Coder 480B (2000 tok/s, Best for Coding)',
      provider: 'Cerebras',
      maxTokenAllowed: 262000,
    },
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'gpt-oss-120b',
      label: 'GPT OSS 120B (Reasoning)',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen-3-235b-a22b-instruct-2507',
      label: 'Qwen 3 235B A22B Instruct',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen-3-235b-a22b-thinking-2507',
      label: 'Qwen 3 235B A22B Thinking',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'zai-glm-4.6',
      label: 'ZAI GLM 4.6 (Coding: 73.8% SWE-bench)',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'zai-glm-4.7',
      label: 'ZAI GLM 4.7 (Reasoning)',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.cerebras.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`Cerebras API error: ${response.statusText}`);
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
            maxTokenAllowed: 32000, // Default, Cerebras typically has good context
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch Cerebras models:`, error);
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cerebras = createCerebras({
      apiKey,
    });

    return cerebras(model);
  }
}
