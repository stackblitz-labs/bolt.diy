import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  baseUrl = 'https://api.cerebras.ai/v1';
  getApiKeyLink = 'https://cloud.cerebras.ai/platform';

  config = {
    baseUrlKey: 'CEREBRAS_API_BASE_URL',
    apiTokenKey: 'CEREBRAS_API_KEY',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: { ...settings, baseUrl: this.baseUrl },
      serverEnv,
      defaultBaseUrlKey: `${this.config.baseUrlKey}`,
      defaultApiTokenKey: `${this.config.apiTokenKey}`,
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    return res.data.map((model: any) => ({
      name: model.id,
      label: model.id,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: { ...providerSettings?.[this.name], baseUrl: this.baseUrl },
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: `${this.config.baseUrlKey}`,
      defaultApiTokenKey: `${this.config.apiTokenKey}`,
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
