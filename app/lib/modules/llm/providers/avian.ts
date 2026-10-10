import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class AvianProvider extends BaseProvider {
  name = 'Avian';
  getApiKeyLink = 'https://avian.io';

  config = {
    apiTokenKey: 'AVIAN_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2', provider: 'Avian', maxTokenAllowed: 163840 },
    { name: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', provider: 'Avian', maxTokenAllowed: 131072 },
    { name: 'z-ai/glm-5', label: 'GLM-5', provider: 'Avian', maxTokenAllowed: 131072 },
    { name: 'minimax/minimax-m2.5', label: 'MiniMax M2.5', provider: 'Avian', maxTokenAllowed: 131072 },
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
      defaultApiTokenKey: 'AVIAN_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.avian.io/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`Avian API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      const dynamicModels =
        data.data
          ?.filter((model: any) => !staticModelIds.includes(model.id))
          .map((m: any) => ({
            name: m.id,
            label: `${m.id} (Dynamic)`,
            provider: this.name,
            maxTokenAllowed: 128000,
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch Avian models:`, error);
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

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'AVIAN_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.avian.io/v1',
      apiKey,
    });

    return openai.chat(model);
  }
}
