import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class OpenAIProvider extends BaseProvider {
  name = 'OpenAI';
  getApiKeyLink = 'https://platform.openai.com/api-keys';

  config = {
    apiTokenKey: 'OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'gpt-4o',
      label: 'GPT-4o',
      provider: 'OpenAI',
      maxTokenAllowed: 8000,
      features: {
        reasoning: true,
        imageGeneration: true,
      },
    },
    {
      name: 'gpt-4.5-turbo',
      label: 'GPT-4.5 Turbo',
      provider: 'OpenAI',
      maxTokenAllowed: 16000,
      features: {
        reasoning: true,
        imageGeneration: true,
      },
    },
    {
      name: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      provider: 'OpenAI',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'gpt-4-turbo',
      label: 'GPT-4 Turbo',
      provider: 'OpenAI',
      maxTokenAllowed: 8000,
      features: {
        reasoning: true,
        imageGeneration: true,
      },
    },
    {
      name: 'gpt-4',
      label: 'GPT-4',
      provider: 'OpenAI',
      maxTokenAllowed: 8000,
    },
    {
      name: 'gpt-3.5-turbo',
      label: 'GPT-3.5 Turbo',
      provider: 'OpenAI',
      maxTokenAllowed: 4000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.openai.com/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' &&
        (model.id.startsWith('gpt-') || model.id.startsWith('o') || model.id.startsWith('chatgpt-')) &&
        !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      // Check if model supports reasoning
      const supportsReasoning = m.id.includes('gpt-4o') || m.id.includes('gpt-4.5') || m.id.includes('gpt-4-turbo');

      return {
        name: m.id,
        label: `${m.id}`,
        provider: this.name,
        maxTokenAllowed: m.context_window || 16000,
        features: {
          reasoning: supportsReasoning,
        },
      };
    });
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
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    // Configure model options
    const openaiOptions: any = {
      apiKey,
    };

    // Enable responses API for newer models
    if (model.includes('gpt-4o') || model.includes('gpt-4.5')) {
      openaiOptions.useResponses = true;
    }

    // Configure reasoning for supported models
    if (model.includes('gpt-4o') || model.includes('gpt-4.5') || model.includes('gpt-4-turbo')) {
      openaiOptions.providerOptions = {
        reasoning_effort: 'high',
      };
    }

    const openai = createOpenAI(openaiOptions);

    return openai(model);
  }
}
