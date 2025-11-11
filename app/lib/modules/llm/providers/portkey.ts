import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class PortkeyProvider extends BaseProvider {
  name = 'Portkey';
  getApiKeyLink = 'https://portkey.ai/docs/api-reference/authentication';

  config = {
    baseUrlKey: 'PORTKEY_API_BASE_URL',
    apiTokenKey: 'PORTKEY_API_KEY',
  };

  // No static models - all models are user-configurable
  staticModels: ModelInfo[] = [];

  // Get custom models from user settings
  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    _serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    // Return user-configured custom models
    return settings?.customModels || [];
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
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'PORTKEY_API_BASE_URL',
      defaultApiTokenKey: 'PORTKEY_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    // Get custom headers from settings, with Portkey defaults
    const customHeaders = {
      'x-portkey-debug': 'false', // Default Portkey header
      ...providerSettings?.[this.name]?.customHeaders, // User-defined headers override defaults
    };

    return getOpenAILikeModel(baseUrl, apiKey, model, customHeaders);
  }
}
