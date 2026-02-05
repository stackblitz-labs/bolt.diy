import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createFireworks } from '@ai-sdk/fireworks';

export default class FireworksProvider extends BaseProvider {
  name = 'Fireworks';
  getApiKeyLink = 'https://fireworks.ai/api-keys';

  config = {
    apiTokenKey: 'FIREWORKS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'accounts/fireworks/models/qwen3-coder-480b-a35b-instruct',
      label: 'Qwen3-Coder 480B (Best for Coding)',
      provider: 'Fireworks',
      maxTokenAllowed: 262000,
    },
    {
      name: 'accounts/fireworks/models/qwen3-coder-30b-a3b-instruct',
      label: 'Qwen3-Coder 30B (Fast Coding)',
      provider: 'Fireworks',
      maxTokenAllowed: 262000,
    },
    {
      name: 'accounts/fireworks/models/llama-v3p1-405b-instruct',
      label: 'Llama 3.1 405B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 128000,
    },
    {
      name: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      label: 'Llama 3.1 70B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 128000,
    },
    {
      name: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 128000,
    },
    {
      name: 'accounts/fireworks/models/deepseek-r1',
      label: 'DeepSeek R1 (Reasoning)',
      provider: 'Fireworks',
      maxTokenAllowed: 64000,
    },
    {
      name: 'accounts/fireworks/models/qwen2p5-72b-instruct',
      label: 'Qwen 2.5 72B Instruct',
      provider: 'Fireworks',
      maxTokenAllowed: 128000,
    },
    {
      name: 'accounts/fireworks/models/firefunction-v2',
      label: 'FireFunction V2',
      provider: 'Fireworks',
      maxTokenAllowed: 8000,
    },
  ];

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
      defaultApiTokenKey: 'FIREWORKS_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const fireworks = createFireworks({
      apiKey,
    });

    return fireworks(model);
  }
}
