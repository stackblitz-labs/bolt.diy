import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createScopedLogger } from '~/utils/logger';
import {
  validatePerplexityModel,
  getAvailableModels,
  formatModelLabel,
} from '~/lib/modules/llm/utils/perplexity-utils';

export default class PerplexityProvider extends BaseProvider {
  name = 'Perplexity';
  getApiKeyLink = 'https://www.perplexity.ai/settings/api';
  private _logger = createScopedLogger('PerplexityProvider');

  config = {
    apiTokenKey: 'PERPLEXITY_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // 2025 Sonar Model Family - Built on Llama 3.3 70B
    {
      name: 'sonar',
      label: 'Sonar (Llama 3.3 70B) - Fast AI Search',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'sonar-pro',
      label: 'Sonar Pro - Advanced Search with Extended Citations',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'sonar-reasoning',
      label: 'Sonar Reasoning - Chain of Thought Search',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'sonar-reasoning-pro',
      label: 'Sonar Reasoning Pro - Advanced Chain of Thought',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
      maxCompletionTokens: 8192,
    },
    {
      name: 'sonar-deep-research',
      label: 'Sonar Deep Research - Expert-Level Analysis',
      provider: 'Perplexity',
      maxTokenAllowed: 127072,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    try {
      // Get available models from utility for validation
      const availableModels = getAvailableModels();

      this._logger.info(`Found ${availableModels.length} available Perplexity models`);

      return availableModels.map((model) => ({
        name: model.id,
        label: formatModelLabel(model.id),
        provider: this.name,
        maxTokenAllowed: model.maxTokens,
        maxCompletionTokens: 8192,
      }));
    } catch (error) {
      this._logger.warn('Failed to fetch dynamic models, using static models:', error);
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

    // Validate model before creating instance
    const validation = validatePerplexityModel(model);

    if (!validation.isValid) {
      this._logger.error('Invalid model:', validation.error);
      throw new Error(validation.error);
    }

    if (validation.warning) {
      this._logger.warn('Model deprecation warning:', validation.warning);
    }

    this._logger.info('Creating model instance for', model);

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'PERPLEXITY_API_KEY',
    });

    if (!apiKey) {
      this._logger.error('No API key found');
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    this._logger.info('API key configured successfully');

    const perplexity = createOpenAI({
      baseURL: 'https://api.perplexity.ai/',
      apiKey,
    });

    return perplexity(model);
  }
}
