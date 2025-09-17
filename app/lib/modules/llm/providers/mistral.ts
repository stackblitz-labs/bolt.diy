import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createMistral } from '@ai-sdk/mistral';

export default class MistralProvider extends BaseProvider {
  name = 'Mistral';
  getApiKeyLink = 'https://console.mistral.ai/api-keys/';

  config = {
    apiTokenKey: 'MISTRAL_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // Latest and most capable models
    {
      name: 'mistral-large-latest',
      label: 'Mistral Large Latest',
      provider: 'Mistral',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'mistral-small-latest',
      label: 'Mistral Small Latest',
      provider: 'Mistral',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Code-specific models
    {
      name: 'codestral-latest',
      label: 'Codestral Latest',
      provider: 'Mistral',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'open-codestral-mamba',
      label: 'Codestral Mamba',
      provider: 'Mistral',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 8192,
    },

    // Open source models
    {
      name: 'open-mixtral-8x22b',
      label: 'Mixtral 8x22B',
      provider: 'Mistral',
      maxTokenAllowed: 65000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'open-mixtral-8x7b',
      label: 'Mixtral 8x7B',
      provider: 'Mistral',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'open-mistral-nemo',
      label: 'Mistral Nemo',
      provider: 'Mistral',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'open-mistral-7b',
      label: 'Mistral 7B',
      provider: 'Mistral',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'ministral-8b-latest',
      label: 'Ministral 8B',
      provider: 'Mistral',
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
      defaultApiTokenKey: 'MISTRAL_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from Mistral API: ${response.status} ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      // Determine context window and completion tokens based on model name
      let maxTokenAllowed = 32000; // default fallback
      const maxCompletionTokens = 8192; // standard completion limit

      const modelName = m.id.toLowerCase();

      if (modelName.includes('large')) {
        maxTokenAllowed = 128000; // Large models support 128k
      } else if (modelName.includes('small')) {
        maxTokenAllowed = 128000; // Small models also support 128k
      } else if (modelName.includes('codestral-mamba')) {
        maxTokenAllowed = 256000; // Codestral Mamba has 256k context
      } else if (modelName.includes('codestral')) {
        maxTokenAllowed = 32000; // Codestral has 32k context
      } else if (modelName.includes('nemo')) {
        maxTokenAllowed = 128000; // Nemo has 128k context
      } else if (modelName.includes('mixtral-8x22b')) {
        maxTokenAllowed = 65000; // Mixtral 8x22B has 65k context
      } else if (modelName.includes('mixtral')) {
        maxTokenAllowed = 32000; // Other Mixtral models have 32k context
      } else if (modelName.includes('ministral')) {
        maxTokenAllowed = 128000; // Ministral has 128k context
      }

      return {
        name: m.id,
        label: `${m.id} (${Math.floor(maxTokenAllowed / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed,
        maxCompletionTokens,
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

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'MISTRAL_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const mistral = createMistral({
      apiKey,
    });

    return mistral(model);
  }
}
