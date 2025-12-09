import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai/platform/api-keys';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
  };

  staticModels: ModelInfo[] = [
    // Llama 3.1 8B - Fast and efficient
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },

    // Llama 3.3 70B - High performance
    {
      name: 'llama-3.3-70b',
      label: 'Llama 3.3 70B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },

    // Qwen 3 32B - Balanced model
    {
      name: 'qwen-3-32b',
      label: 'Qwen 3 32B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },

    // Qwen 3 235B - Large preview model
    {
      name: 'qwen-3-235b-a22b-instruct-2507',
      label: 'Qwen 3 235B Instruct (Preview)',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },

    // GPT-OSS 120B - Open source large model
    {
      name: 'gpt-oss-120b',
      label: 'GPT-OSS 120B',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },

    // ZAI GLM 4.6 - Preview model
    {
      name: 'zai-glm-4.6',
      label: 'ZAI GLM 4.6 (Preview)',
      provider: 'Cerebras',
      maxTokenAllowed: 8192, // Free tier limited to 8k context
      maxCompletionTokens: 4096,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    providerSettings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      return this.staticModels;
    }

    try {
      const cerebras = createCerebras({
        apiKey,
        baseURL: this.config.baseUrl,
      });

      // Fetch available models from Cerebras API
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json() as { data?: any[] };
      
      if (data.data && Array.isArray(data.data)) {
        return data.data.map((model: any) => {
          // Determine context window and completion tokens based on model
          let maxTokenAllowed = 8192; // Default for free tier
          let maxCompletionTokens = 4096;

          // Model-specific configurations
          if (model.id.includes('70b') || model.id.includes('235b')) {
            maxCompletionTokens = 4096;
          } else if (model.id.includes('120b')) {
            maxCompletionTokens = 4096;
          }

          return {
            name: model.id,
            label: `${model.id} (${Math.floor(maxTokenAllowed / 1000)}k context)`,
            provider: this.name,
            maxTokenAllowed,
            maxCompletionTokens,
          };
        });
      }

      return this.staticModels;
    } catch (error) {
      console.error('Error fetching Cerebras models:', error);
      return this.staticModels;
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
      baseURL: this.config.baseUrl,
    });

    return cerebras(model) as unknown as LanguageModelV1;
  }
}
