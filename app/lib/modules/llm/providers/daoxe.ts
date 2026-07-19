import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

interface DaoXEModel {
  id: string;
  object?: string;
  owned_by?: string;
}

interface DaoXEModelsResponse {
  data: DaoXEModel[];
  object?: string;
}

export default class DaoXEProvider extends BaseProvider {
  name = 'DaoXE';
  getApiKeyLink = 'https://daoxe.com';
  labelForGetApiKey = 'Get DaoXE API Key';
  icon = 'i-ph:cloud-arrow-up';

  config = {
    baseUrlKey: 'DAOXE_API_BASE_URL',
    apiTokenKey: 'DAOXE_API_KEY',
    baseUrl: 'https://daoxe.com/v1',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'DAOXE_API_BASE_URL',
      defaultApiTokenKey: 'DAOXE_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    const effectiveBaseUrl = baseUrl || 'https://daoxe.com/v1';

    try {
      const response = await fetch(`${effectiveBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as DaoXEModelsResponse;

      return res.data.map((model) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: 128000,
      }));
    } catch (error) {
      console.error('Error fetching DaoXE models:', error);
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
    const envRecord = this.convertEnvToRecord(serverEnv);

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'DAOXE_API_BASE_URL',
      defaultApiTokenKey: 'DAOXE_API_KEY',
    });

    const effectiveBaseUrl = baseUrl || 'https://daoxe.com/v1';

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    return getOpenAILikeModel(effectiveBaseUrl, apiKey, model);
  }
}
