import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class MoonshotProvider extends BaseProvider {
  name = 'Moonshot';
  getApiKeyLink = 'https://platform.moonshot.ai/console/api-keys';

  config = {
    apiTokenKey: 'MOONSHOT_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'moonshot-v1-8k', label: 'Moonshot v1 8K', provider: 'Moonshot', maxTokenAllowed: 8000 },
    { name: 'moonshot-v1-32k', label: 'Moonshot v1 32K', provider: 'Moonshot', maxTokenAllowed: 32000 },
    { name: 'moonshot-v1-128k', label: 'Moonshot v1 128K', provider: 'Moonshot', maxTokenAllowed: 128000 },
    { name: 'moonshot-v1-auto', label: 'Moonshot v1 Auto', provider: 'Moonshot', maxTokenAllowed: 128000 },
    {
      name: 'moonshot-v1-8k-vision-preview',
      label: 'Moonshot v1 8K Vision',
      provider: 'Moonshot',
      maxTokenAllowed: 8000,
    },
    {
      name: 'moonshot-v1-32k-vision-preview',
      label: 'Moonshot v1 32K Vision',
      provider: 'Moonshot',
      maxTokenAllowed: 32000,
    },
    {
      name: 'moonshot-v1-128k-vision-preview',
      label: 'Moonshot v1 128K Vision',
      provider: 'Moonshot',
      maxTokenAllowed: 128000,
    },
    { name: 'kimi-latest', label: 'Kimi Latest', provider: 'Moonshot', maxTokenAllowed: 128000 },
    { name: 'kimi-k2-0711-preview', label: 'Kimi K2 Preview', provider: 'Moonshot', maxTokenAllowed: 128000 },
    { name: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo', provider: 'Moonshot', maxTokenAllowed: 128000 },
    { name: 'kimi-thinking-preview', label: 'Kimi Thinking', provider: 'Moonshot', maxTokenAllowed: 128000 },
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
      defaultApiTokenKey: 'MOONSHOT_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://api.moonshot.ai/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`Moonshot API error: ${response.statusText}`);
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
            maxTokenAllowed: 128000, // Kimi models typically have large context
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch Moonshot models:`, error);
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
      defaultApiTokenKey: 'MOONSHOT_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api.moonshot.ai/v1',
      apiKey,
    });

    return openai(model);
  }
}
