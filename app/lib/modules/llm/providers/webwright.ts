import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

interface WebWrightModelsResponse {
  data: Array<{ context_length?: number; id: string }>;
}

export default class WebWrightProvider extends BaseProvider {
  name = 'WebWright';
  getApiKeyLink = 'https://webwright.ai/account';

  config = {
    baseUrlKey: 'WEBWRIGHT_BASE_URL',
    apiTokenKey: 'WEBWRIGHT_API_KEY',
    baseUrl: 'https://webwright.ai/v1',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'wren-r1',
      label: 'Wren R1',
      provider: 'WebWright',
      maxTokenAllowed: 200000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'WEBWRIGHT_BASE_URL',
      defaultApiTokenKey: 'WEBWRIGHT_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        return [];
      }

      const res = (await response.json()) as WebWrightModelsResponse;

      return res.data.map((model) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: model.context_length || 8000,
      }));
    } catch {
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'WEBWRIGHT_BASE_URL',
      defaultApiTokenKey: 'WEBWRIGHT_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing Api Key configuration for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: baseUrl || 'https://webwright.ai/v1',
      apiKey,
    });

    return openai.chat(model);
  }
}
