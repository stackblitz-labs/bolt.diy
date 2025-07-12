import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class V0Provider extends BaseProvider {
  name = 'v0';
  getApiKeyLink = 'https://v0.dev/chat/settings/keys';

  config = {
    apiTokenKey: 'V0_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'v0-1.5-lg',
      label: 'v0 1.5 Large',
      provider: 'v0',
      maxTokenAllowed: 32000,
    },
    {
      name: 'v0-1.5-md',
      label: 'v0 1.5 Medium',
      provider: 'v0',
      maxTokenAllowed: 32000,
    },
    {
      name: 'v0-1.0-md',
      label: 'v0 1.0 Medium (Legacy)',
      provider: 'v0',
      maxTokenAllowed: 32000,
    },
  ];

  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    // v0 has fixed models, so we return empty array for dynamic models
    return [];
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
      defaultApiTokenKey: 'V0_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const v0 = createOpenAI({
      apiKey,
      baseURL: 'https://api.v0.dev/v1',
    });

    return v0(model);
  }
}
