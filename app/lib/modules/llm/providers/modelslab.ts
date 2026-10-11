import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class ModelsLabProvider extends BaseProvider {
  name = 'ModelsLab';
  getApiKeyLink = 'https://modelslab.com/dashboard/settings';
  labelForGetApiKey = 'Get ModelsLab API Key';
  icon = 'i-ph:cloud-lightning';

  config = {
    baseUrlKey: 'MODELSLAB_API_BASE_URL',
    apiTokenKey: 'MODELSLAB_API_KEY',
    baseUrl: 'https://modelslab.com/api/uncensored-chat/v1',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'meta-llama/llama-3.1-8b-instruct-uncensored',
      label: 'Llama 3.1 8B Uncensored (ModelsLab)',
      provider: 'ModelsLab',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 4096,
    },
    {
      name: 'meta-llama/llama-3.1-70b-instruct-uncensored',
      label: 'Llama 3.1 70B Uncensored (ModelsLab)',
      provider: 'ModelsLab',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 4096,
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
      defaultBaseUrlKey: 'MODELSLAB_API_BASE_URL',
      defaultApiTokenKey: 'MODELSLAB_API_KEY',
    });

    const resolvedBaseUrl = baseUrl || 'https://modelslab.com/api/uncensored-chat/v1';

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${resolvedBaseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        return [];
      }

      const res = (await response.json()) as any;
      const models = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

      return models
        .filter((m: any) => m.id || m.name)
        .map((m: any) => ({
          name: m.id || m.name,
          label: m.display_name || m.id || m.name,
          provider: this.name,
          maxTokenAllowed: m.context_length || 32768,
          maxCompletionTokens: m.max_completion_tokens || 4096,
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
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: this.convertEnvToRecord(serverEnv),
      defaultBaseUrlKey: 'MODELSLAB_API_BASE_URL',
      defaultApiTokenKey: 'MODELSLAB_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider. Set MODELSLAB_API_KEY in your environment.`);
    }

    const resolvedBaseUrl = this.resolveDockerUrl(
      baseUrl || 'https://modelslab.com/api/uncensored-chat/v1',
      this.convertEnvToRecord(serverEnv),
    );

    return getOpenAILikeModel(resolvedBaseUrl, apiKey, model);
  }
}
