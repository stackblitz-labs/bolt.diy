import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { logger } from '~/utils/logger';

const HUBRIS_API_BASE_URL = 'https://api.hubris.pw/v1';

interface HubrisModel {
  id: string;
  display_name?: string;
  context_window?: number;
  output_modalities?: string[];
  supported_parameters?: string[];
}

interface HubrisModelsResponse {
  data: HubrisModel[];
}

/**
 * Hubris (https://hubris.pw) is an OpenAI-compatible LLM gateway billed in Russian rubles:
 * one API key for 500+ models from OpenAI, Anthropic, Google, DeepSeek, Qwen and others.
 * Model ids use the full `vendor/model` form from the catalog at https://hubris.pw/models.
 */
export default class HubrisProvider extends BaseProvider {
  name = 'Hubris';
  getApiKeyLink = 'https://hubris.pw/keys';

  config = {
    apiTokenKey: 'HUBRIS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'anthropic/claude-sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'Hubris',
      maxTokenAllowed: 1000000,
    },
    {
      name: 'anthropic/claude-haiku-4.5',
      label: 'Claude Haiku 4.5',
      provider: 'Hubris',
      maxTokenAllowed: 200000,
    },
    {
      name: 'openai/gpt-5.6-luna',
      label: 'GPT-5.6 Luna',
      provider: 'Hubris',
      maxTokenAllowed: 1050000,
    },
    {
      name: 'google/gemini-3.7-flash',
      label: 'Gemini 3.7 Flash',
      provider: 'Hubris',
      maxTokenAllowed: 1048576,
    },
    {
      name: 'deepseek/deepseek-v4-flash-0731',
      label: 'DeepSeek V4 Flash',
      provider: 'Hubris',
      maxTokenAllowed: 1310720,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'HUBRIS_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${HUBRIS_API_BASE_URL}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        logger.error(`Hubris API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as HubrisModelsResponse;
      const staticModelIds = this.staticModels.map((m) => m.name);

      return data.data
        .filter((model) => !staticModelIds.includes(model.id))
        // Only chat models that speak plain text; image, video, speech and embedding models are skipped.
        .filter((model) => !model.output_modalities || model.output_modalities.includes('text'))
        .filter((model) => !model.supported_parameters || model.supported_parameters.includes('tools'))
        .map((model) => ({
          name: model.id,
          label: model.display_name ? `${model.display_name} (${model.context_window ? Math.floor(model.context_window / 1000) + 'k' : 'dynamic'})` : model.id,
          provider: this.name,
          maxTokenAllowed: model.context_window || 32000,
        }));
    } catch (error) {
      logger.error('Failed to fetch Hubris models:', error);
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

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'HUBRIS_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    return getOpenAILikeModel(HUBRIS_API_BASE_URL, apiKey, model);
  }
}
