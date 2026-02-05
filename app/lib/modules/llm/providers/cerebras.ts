import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';

export default class CerebrasProvider extends BaseProvider {
  name = 'Cerebras';
  getApiKeyLink = 'https://cloud.cerebras.ai/settings';

  config = {
    apiTokenKey: 'CEREBRAS_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'llama3.1-8b',
      label: 'Llama 3.1 8B',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'llama-3.3-70b',
      label: 'Llama 3.3 70B',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'gpt-oss-120b',
      label: 'GPT OSS 120B (Reasoning)',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen-3-32b',
      label: 'Qwen 3 32B',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen-3-235b-a22b-instruct-2507',
      label: 'Qwen 3 235B A22B Instruct',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen-3-235b-a22b-thinking-2507',
      label: 'Qwen 3 235B A22B Thinking',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'zai-glm-4.6',
      label: 'ZAI GLM 4.6',
      provider: 'Cerebras',
      maxTokenAllowed: 8000,
    },
    {
      name: 'zai-glm-4.7',
      label: 'ZAI GLM 4.7 (Reasoning)',
      provider: 'Cerebras',
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
      defaultApiTokenKey: 'CEREBRAS_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cerebras = createCerebras({
      apiKey,
    });

    return cerebras(model);
  }
}
