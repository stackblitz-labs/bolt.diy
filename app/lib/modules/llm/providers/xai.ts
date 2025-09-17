import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class XAIProvider extends BaseProvider {
  name = 'xAI';
  getApiKeyLink = 'https://docs.x.ai/docs/quickstart#creating-an-api-key';

  config = {
    apiTokenKey: 'XAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'grok-4',
      label: 'xAI Grok 4',
      provider: 'xAI',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'grok-4-07-09',
      label: 'xAI Grok 4 (07-09)',
      provider: 'xAI',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'grok-3-mini',
      label: 'xAI Grok 3 Mini',
      provider: 'xAI',
      maxTokenAllowed: 131000,
      maxCompletionTokens: 16000,
    },
    {
      name: 'grok-3-mini-fast',
      label: 'xAI Grok 3 Mini Fast',
      provider: 'xAI',
      maxTokenAllowed: 131000,
      maxCompletionTokens: 16000,
    },
    {
      name: 'grok-code-fast-1',
      label: 'xAI Grok Code Fast 1',
      provider: 'xAI',
      maxTokenAllowed: 131000,
      maxCompletionTokens: 16000,
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
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch('https://api.x.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from xAI API: ${response.status} ${response.statusText}`);
    }

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      // Determine context window and completion tokens based on model name
      let maxTokenAllowed = 131000; // default for Grok models
      let maxCompletionTokens = 16000; // default completion limit

      const modelName = m.id.toLowerCase();

      if (modelName.includes('grok-4')) {
        maxTokenAllowed = 256000; // Grok 4 has larger context
        maxCompletionTokens = 32000;
      } else if (modelName.includes('grok-3-mini')) {
        maxTokenAllowed = 131000; // Grok 3 Mini standard context
        maxCompletionTokens = 16000;
      } else if (modelName.includes('grok-code')) {
        maxTokenAllowed = 131000; // Code models standard context
        maxCompletionTokens = 16000;
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
      defaultApiTokenKey: 'XAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
