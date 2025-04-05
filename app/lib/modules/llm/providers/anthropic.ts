import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
import { createAnthropic } from '@ai-sdk/anthropic';

export default class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'claude-3-7-sonnet-20250219',
      label: 'Claude 3.7 Sonnet',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        reasoning: true,
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-5-sonnet-latest',
      label: 'Claude 3.5 Sonnet (new)',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-5-sonnet-20240620',
      label: 'Claude 3.5 Sonnet (old)',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-5-haiku-latest',
      label: 'Claude 3.5 Haiku (new)',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-opus-latest',
      label: 'Claude 3 Opus',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-sonnet-20240229',
      label: 'Claude 3 Sonnet',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
    },
    {
      name: 'claude-3-haiku-20240307',
      label: 'Claude 3 Haiku',
      provider: 'Anthropic',
      maxTokenAllowed: 8000,
      features: {
        imageGeneration: true,
      },
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
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.anthropic.com/v1/models`, {
      headers: {
        'x-api-key': `${apiKey}`,
        'anthropic-version': '2023-06-01',
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => model.type === 'model' && !staticModelIds.includes(model.id));

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.display_name}`,
      provider: this.name,
      maxTokenAllowed: 32000,

      // Add features based on model capabilities
      features: {
        reasoning: m.id.includes('claude-3-7') || m.id.includes('claude-3-5'),
        imageGeneration: m.id.includes('claude-3'),
      },
    }));
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
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    // Find model info to check if it supports reasoning
    const modelInfo = this.findModelInfo(model);
    const supportsReasoning = modelInfo.features?.reasoning;

    // Configure anthropic with reasoning settings if supported
    const anthropicOptions: any = {
      apiKey,

      // Use the latest API version
      anthropicVersion: '2023-06-01',
    };

    // Add reasoning-specific options for Claude models
    if (supportsReasoning) {
      anthropicOptions.providerOptions = {
        system:
          'When you need to think step-by-step about a problem, please use the <think></think> XML tags to show your reasoning.',
      };
    }

    const anthropic = createAnthropic(anthropicOptions);

    return anthropic(model);
  }
}
