import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

const DEFAULT_BASE_URL = 'https://llmtr.com/v1';

interface LlmtrModel {
  id: string;
  object?: string;
  context_length?: number;
  context_window?: number;
  architecture?: { output_modalities?: string[] };
}

interface LlmtrModelsResponse {
  data?: LlmtrModel[];
}

export default class LLMTRProvider extends BaseProvider {
  name = 'LLMTR';
  getApiKeyLink = 'https://llmtr.com/dashboard/keys';

  config = {
    apiTokenKey: 'LLMTR_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'minimax/minimax-m3.1-flash',
      label: 'MiniMax M3.1 Flash',
      provider: 'LLMTR',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'llmtr/qwen3-8-27b',
      label: 'Qwen3 8-27B (hosted in Turkey)',
      provider: 'LLMTR',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'llmtr/gemma-4',
      label: 'Gemma 4 (hosted in Turkey)',
      provider: 'LLMTR',
      maxTokenAllowed: 131072,
      maxCompletionTokens: 8192,
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
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'LLMTR_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${DEFAULT_BASE_URL}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        return [];
      }

      const res = (await response.json()) as LlmtrModelsResponse;
      const data = Array.isArray(res.data) ? res.data : [];

      return data
        .filter(
          (model) => !model.architecture?.output_modalities || model.architecture.output_modalities.includes('text'),
        )
        .map((m) => {
          const context = m.context_length || m.context_window || 128000;
          const capped = Math.min(context, 2000000);
          const contextLabel = capped >= 1000000 ? `${Math.floor(capped / 1000000)}M` : `${Math.floor(capped / 1000)}k`;

          return {
            name: m.id,
            label: `${m.id} - context ${contextLabel}`,
            provider: this.name,
            maxTokenAllowed: capped,
            maxCompletionTokens: 8192,
          };
        });
    } catch (error) {
      console.error('Error getting LLMTR models:', error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'LLMTR_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: DEFAULT_BASE_URL,
      apiKey,
    });

    return openai.chat(model);
  }
}
