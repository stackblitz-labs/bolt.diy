import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelsKey: 'OPENAI_LIKE_API_MODELS',
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
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as any;

      return res.data.map((model: any) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: 8000,
      }));
    } catch (error) {
      console.log(`${this.name}: Not allowed to GET /models endpoint for provider`, error);

      // Fallback to OPENAI_LIKE_API_MODELS if available
      // eslint-disable-next-line dot-notation
      const modelsEnv = serverEnv['OPENAI_LIKE_API_MODELS'] || settings?.OPENAI_LIKE_API_MODELS;

      if (modelsEnv) {
        console.log(`${this.name}: OPENAI_LIKE_API_MODELS=${modelsEnv}`);
        return this._parseModelsFromEnv(modelsEnv);
      }

      return [];
    }
  }

  /**
   * Parse OPENAI_LIKE_API_MODELS environment variable
   * Format: path/to/model1:limit;path/to/model2:limit;path/to/model3:limit
   */
  private _parseModelsFromEnv(modelsEnv: string): ModelInfo[] {
    if (!modelsEnv) {
      return [];
    }

    try {
      const models: ModelInfo[] = [];
      const modelEntries = modelsEnv.split(';');

      for (const entry of modelEntries) {
        const trimmedEntry = entry.trim();

        if (!trimmedEntry) {
          continue;
        }

        const [modelPath, limitStr] = trimmedEntry.split(':');

        if (!modelPath) {
          continue;
        }

        const limit = limitStr ? parseInt(limitStr.trim(), 10) : 8000;
        const modelName = modelPath.trim();

        // Generate a readable label from the model path
        const label = this._generateModelLabel(modelName);

        models.push({
          name: modelName,
          label,
          provider: this.name,
          maxTokenAllowed: limit,
        });
      }

      console.log(`${this.name}: Parsed Models:`, models);

      return models;
    } catch (error) {
      console.error(`${this.name}: Error parsing OPENAI_LIKE_API_MODELS:`, error);
      return [];
    }
  }

  /**
   * Generate a readable label from model path
   */
  private _generateModelLabel(modelPath: string): string {
    // Extract the last part of the path and clean it up
    const parts = modelPath.split('/');
    const lastPart = parts[parts.length - 1];

    // Remove common prefixes and clean up the name
    let label = lastPart
      .replace(/^accounts\//, '')
      .replace(/^fireworks\/models\//, '')
      .replace(/^models\//, '')
      // Capitalize first letter of each word
      .replace(/\b\w/g, (l) => l.toUpperCase())
      // Replace spaces with hyphens for a cleaner look
      .replace(/\s+/g, '-');

    // Add provider suffix if not already present
    if (!label.includes('Fireworks') && !label.includes('OpenAI')) {
      label += ' (OpenAI Compatible)';
    }

    return label;
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
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
