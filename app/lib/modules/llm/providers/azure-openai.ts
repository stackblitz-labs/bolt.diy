import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createAzure } from '../lib/azure-openai';

export default class AzureOpenAIProvider extends BaseProvider {
  name = 'Azure OpenAI';
  getApiKeyLink = 'https://portal.azure.com/';

  config = {
    apiTokenKey: 'AZURE_OPENAI_API_KEY',
    resourceName: 'AZURE_OPENAI_RESOURCE_NAME',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    // Azure OpenAI doesn't have a public API for listing models.
    // Models are deployed and named by the user.
    // For now, we'll just return an empty array.
    // In the future, we could add a way for users to add their own models.
    return [];
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey, resourceName } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'AZURE_OPENAI_API_KEY',
      defaultResourceNameKey: 'AZURE_OPENAI_RESOURCE_NAME',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    if (!resourceName) {
      throw new Error(`Missing resource name for ${this.name} provider`);
    }

    const openai = createAzure(apiKey, resourceName);

    return openai(model);
  }
}
