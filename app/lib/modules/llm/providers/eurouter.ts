import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class EUrouterProvider extends BaseProvider {
  name = 'EUrouter';
  getApiKeyLink = 'https://www.eurouter.ai';

  config = {
    apiTokenKey: 'EUROUTER_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'deepseek-r1', label: 'DeepSeek R1', provider: 'EUrouter', maxTokenAllowed: 64000 },
    { name: 'kimi-k2.5', label: 'Kimi K2.5', provider: 'EUrouter', maxTokenAllowed: 128000 },
    {
      name: 'mistral-large-latest',
      label: 'Mistral Large 3',
      provider: 'EUrouter',
      maxTokenAllowed: 128000,
    },
    { name: 'minimax-m2.5', label: 'MiniMax M2.5', provider: 'EUrouter', maxTokenAllowed: 128000 },
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
      defaultApiTokenKey: 'EUROUTER_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.eurouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`EUrouter API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      const dynamicModels =
        data.data
          ?.filter((model: any) => !staticModelIds.includes(model.id))
          .map((m: any) => ({
            name: m.id,
            label: m.id,
            provider: this.name,
            maxTokenAllowed: 128000,
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error('Failed to fetch EUrouter models:', error);
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
      defaultApiTokenKey: 'EUROUTER_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.eurouter.ai/api/v1',
      apiKey,
      headers: {
        'HTTP-Referer': 'https://bolt.diy',
        'X-EUrouter-Title': 'bolt.diy',
      },
    });

    return openai(model);
  }
}
