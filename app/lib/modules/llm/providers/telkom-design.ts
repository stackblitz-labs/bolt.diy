import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class TelkomDesignProvider extends BaseProvider {
  name = 'TelkomDesign';
  getApiKeyLink = undefined;
  labelForGetApiKey = 'Get Telkom Design API Key';

  // Use default icon
  icon = 'i-ph:robot';

  config = {
    baseUrlKey: 'TELKOM_DESIGN_API_BASE_URL',
    apiTokenKey: 'TELKOM_DESIGN_API_KEY',
    baseUrl: 'https://api-stage-aitools.telkom.design',
  };

  // Default model if dynamic fetching fails
  staticModels: ModelInfo[] = [
    {
      name: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      provider: this.name,
      maxTokenAllowed: 8000,
    },
  ];

  // Implement dynamic model fetching
  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'TELKOM_DESIGN_API_BASE_URL',
      defaultApiTokenKey: 'TELKOM_DESIGN_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return this.staticModels;
    }

    try {
      // Fetch models from the API
      const response = await fetch(`${baseUrl}/v1/openai/models`, {
        headers: {
          'Api-Key': apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        return this.staticModels;
      }

      const data = (await response.json()) as { data: Array<{ id: string }> };

      // Map API response to ModelInfo objects
      return data.data.map((model: any) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: 8000, // Default value, adjust as needed
      }));
    } catch (error) {
      console.error(`Error fetching models for ${this.name}:`, error);
      return this.staticModels;
    }
  }

  // Implement model instance creation with custom headers
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
      defaultBaseUrlKey: 'TELKOM_DESIGN_API_BASE_URL',
      defaultApiTokenKey: 'TELKOM_DESIGN_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    // Create OpenAI instance with custom headers
    const openai = createOpenAI({
      baseURL: `${baseUrl}/v1/openai`, // Add the /v1/openai path
      apiKey, // Use the API key directly (shorthand property)
      headers: {
        'Api-Key': apiKey, // Also include it in the headers
        Authorization: `Bearer ${apiKey}`, // Add standard Authorization header as well
      },
    });

    return openai(model);
  }
}
