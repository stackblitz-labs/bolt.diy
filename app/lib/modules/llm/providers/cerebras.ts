import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai';
  labelForGetApiKey = 'Get Cerebras API Key';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models - only the most stable/reliable ones
     * Llama models with ultra-fast inference speeds
     */
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B (Ultra Fast)',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Llama 3.3 70B: Most capable model with excellent performance
    {
      name: 'llama3.3-70b',
      label: 'Llama 3.3 70B',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Llama 3.1 405B: Flagship model with highest quality
    {
      name: 'llama3.1-405b',
      label: 'Llama 3.1 405B (Flagship)',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Llama 4 Scout: Latest generation model
    {
      name: 'llama-4-scout-17b-16e-instruct',
      label: 'Llama 4 Scout 17B',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Qwen 3 32B: Code and reasoning optimized
    {
      name: 'qwen3-32b',
      label: 'Qwen 3 32B',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Qwen 3 235B: Large reasoning model
    {
      name: 'qwen3-235b-instruct',
      label: 'Qwen 3 235B Instruct',
      provider: 'Cerebras',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
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
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    try {
      // Fetch models from Cerebras API
      const response = await fetch('https://api.cerebras.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const res = (await response.json()) as any;

      if (!res.data) {
        throw new Error('Invalid response from Cerebras API');
      }

      const data = res.data.filter((model: any) => model.object === 'model');

      // Filter out models that are already in staticModels
      const staticModelNames = this.staticModels.map((m) => m.name);
      const dynamicModels = data
        .filter((model: any) => !staticModelNames.includes(model.id))
        .map((m: any) => {
          // Determine appropriate context window and completion limits
          let contextWindow = 128000; // default for most Cerebras models
          let maxCompletionTokens = 8192; // default completion limit

          // Adjust based on model name patterns
          if (m.id?.includes('405b')) {
            contextWindow = 128000;
            maxCompletionTokens = 8192;
          } else if (m.id?.includes('70b')) {
            contextWindow = 128000;
            maxCompletionTokens = 8192;
          } else if (m.id?.includes('32b')) {
            contextWindow = 128000;
            maxCompletionTokens = 8192;
          } else if (m.id?.includes('8b')) {
            contextWindow = 128000;
            maxCompletionTokens = 8192;
          } else if (m.id?.includes('235b')) {
            contextWindow = 128000;
            maxCompletionTokens = 8192;
          }

          return {
            name: m.id,
            label: `${m.id} - Ultra Fast Inference`,
            provider: this.name,
            maxTokenAllowed: contextWindow,
            maxCompletionTokens,
          };
        });

      return dynamicModels;
    } catch (error: any) {
      console.error(`Failed to fetch dynamic models for ${this.name}:`, error.message);
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

    // Cerebras API is OpenAI-compatible
    const openai = createOpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
