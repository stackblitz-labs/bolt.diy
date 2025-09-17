import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class ZAIProvider extends BaseProvider {
  name = 'ZAI';
  getApiKeyLink = 'https://z.ai/model-api';

  config = {
    baseUrlKey: 'ZAI_API_BASE_URL',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    apiTokenKey: 'ZAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'glm-4.5',
      label: 'GLM-4.5',
      provider: 'ZAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'glm-4.5v',
      label: 'GLM-4.5V (Visual)',
      provider: 'ZAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'glm-4-32b-0414-128k',
      label: 'GLM-4-32B (128K)',
      provider: 'ZAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'cogvideox-3',
      label: 'CogVideoX-3 (Video)',
      provider: 'ZAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 32000,
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
      defaultBaseUrlKey: 'ZAI_API_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept-Language': 'en-US,en',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as any;

      // ZAI follows OpenAI format with data array
      if (!res.data || !Array.isArray(res.data)) {
        throw new Error('Invalid response format from ZAI API');
      }

      const staticModelIds = this.staticModels.map((m) => m.name);

      return res.data
        .filter((model: any) => !staticModelIds.includes(model.id))
        .map((model: any) => ({
          name: model.id,
          label: this._generateModelLabel(model.id, model),
          provider: this.name,
          maxTokenAllowed: this._getContextWindow(model.id),
          maxCompletionTokens: this._getMaxCompletionTokens(model.id),
        }));
    } catch (error) {
      console.log(`${this.name}: Error fetching dynamic models:`, error);
      return [];
    }
  }

  private _generateModelLabel(modelId: string, modelData?: any): string {
    // Use display name if available from API
    if (modelData?.display_name) {
      return modelData.display_name;
    }

    // Generate readable label from model ID
    if (modelId.includes('glm-4.5v')) {
      return 'GLM-4.5V (Visual)';
    } else if (modelId.includes('glm-4.5')) {
      return 'GLM-4.5';
    } else if (modelId.includes('glm-4') && modelId.includes('128k')) {
      return 'GLM-4-32B (128K)';
    } else if (modelId.includes('cogvideox')) {
      return 'CogVideoX (Video)';
    }

    // Fallback: capitalize and format the model ID
    return modelId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private _getContextWindow(modelId: string): number {
    // Known context windows for ZAI models
    if (modelId.includes('128k')) {
      return 128000;
    }

    // Default context window for ZAI models
    return 128000;
  }

  private _getMaxCompletionTokens(modelId: string): number {
    // Conservative completion token limits
    if (modelId.includes('cogvideox')) {
      // Video models might have different limits
      return 16000;
    }

    // Default completion tokens for text models
    return 32000;
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
      defaultBaseUrlKey: 'ZAI_API_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    // Create ZAI-specific OpenAI client with required headers
    const openai = createOpenAI({
      baseURL: baseUrl,
      apiKey,
      headers: {
        'Accept-Language': 'en-US,en',
      },
    });

    return openai(model);
  }
}
