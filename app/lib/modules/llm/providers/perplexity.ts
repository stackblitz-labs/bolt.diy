import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  validatePerplexityModel,
  getActivePerplexityModels,
  checkDeprecatedModel,
  isValidPerplexityModelPattern,
} from './perplexity-utils';

export default class PerplexityProvider extends BaseProvider {
  name = 'Perplexity';
  getApiKeyLink = 'https://www.perplexity.ai/settings/api';

  config = {
    apiTokenKey: 'PERPLEXITY_API_KEY',
  };

  // Get models from utility
  staticModels: ModelInfo[] = getActivePerplexityModels().map((model) => ({
    name: model.id,
    label: model.name,
    provider: 'Perplexity',
    maxTokenAllowed: model.context,
  }));

  // Validate if a model name is supported
  isValidModel(modelName: string): boolean {
    // First check exact matches, then patterns
    return validatePerplexityModel(modelName) || isValidPerplexityModelPattern(modelName);
  }

  // Get dynamic models (override base class method)
  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    try {
      /*
       * For now, return static models, but this can be extended
       * to fetch models from Perplexity API when they provide an endpoint
       */
      return this.staticModels;
    } catch (error) {
      console.warn('Failed to fetch dynamic Perplexity models:', error);
      return this.staticModels;
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    // Check for deprecated models
    const deprecationCheck = checkDeprecatedModel(model);

    if (deprecationCheck.deprecated) {
      console.warn(deprecationCheck.message);

      /*
       * Optionally use the replacement model
       * model = deprecationCheck.replacement || model;
       */
    }

    // Validate model before attempting to use it
    if (!this.isValidModel(model)) {
      const validModels = this.staticModels.map((m) => m.name).join(', ');
      throw new Error(`Invalid Perplexity model: "${model}". Valid models are: ${validModels}`);
    }

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'PERPLEXITY_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const perplexity = createOpenAI({
      baseURL: baseUrl || 'https://api.perplexity.ai/',
      apiKey,
    });

    return perplexity(model);
  }
}
