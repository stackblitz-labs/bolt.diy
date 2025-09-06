import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class PerplexityProvider extends BaseProvider {
  name = 'Perplexity';
  getApiKeyLink = 'https://www.perplexity.ai/settings/api';

  config = {
    apiTokenKey: 'PERPLEXITY_API_KEY',
  };

  /*
   * Updated list of current Perplexity models as of 2025
   * Legacy models removed as they are no longer supported
   */
  staticModels: ModelInfo[] = [
    {
      name: 'sonar',
      label: 'Sonar (Llama 3.3 70B)',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
    },
    {
      name: 'sonar-pro',
      label: 'Sonar Pro (Enhanced)',
      provider: 'Perplexity',
      maxTokenAllowed: 200000,
    },
    {
      name: 'sonar-reasoning',
      label: 'Sonar Reasoning',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
    },
  ];

  // List of deprecated models that should show warnings
  deprecatedModels = [
    'llama-3.1-sonar-small-128k-online',
    'llama-3.1-sonar-large-128k-online',
    'llama-3.1-sonar-huge-128k-online',
    'llama-3.1-8b-instruct',
    'llama-3.1-70b-instruct',
  ];

  // Validate model name and provide suggestions
  validateModel(modelName: string): { valid: boolean; message?: string; suggestion?: string } {
    // Check if it's a valid current model
    const validModel = this.staticModels.find((m) => m.name === modelName);

    if (validModel) {
      return { valid: true };
    }

    // Check if it's a deprecated model
    if (this.deprecatedModels.includes(modelName)) {
      const suggestion = modelName.includes('small')
        ? 'sonar'
        : modelName.includes('large')
          ? 'sonar-pro'
          : modelName.includes('huge')
            ? 'sonar-reasoning'
            : 'sonar';
      return {
        valid: false,
        message: `Model '${modelName}' is deprecated and no longer supported by Perplexity API.`,
        suggestion,
      };
    }

    // Unknown model
    return {
      valid: false,
      message: `Unknown model '${modelName}'. Please use one of the supported models.`,
      suggestion: 'sonar',
    };
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    // Validate model before making API call
    const validation = this.validateModel(model);

    if (!validation.valid) {
      console.warn(`[Perplexity] ${validation.message}`);

      if (validation.suggestion) {
        console.warn(`[Perplexity] Using suggested model: ${validation.suggestion}`);

        // Use the suggested model instead
        const suggestedModel = validation.suggestion;

        return this.getModelInstance({ ...options, model: suggestedModel });
      }
    }

    const { apiKey } = this.getProviderBaseUrlAndKey({
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
      baseURL: 'https://api.perplexity.ai/',
      apiKey,
    });

    return perplexity(model);
  }
}
