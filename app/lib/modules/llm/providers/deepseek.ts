import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

export default class DeepseekProvider extends BaseProvider {
  name = 'Deepseek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // V3 Models (Latest and most powerful) - 128k context, enhanced reasoning
    {
      name: 'deepseek-chat',
      label: 'DeepSeek V3 Chat',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // V3 supports 128k context
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-coder',
      label: 'DeepSeek V3 Coder',
      provider: 'Deepseek',
      maxTokenAllowed: 128000, // V3 supports 128k context
      maxCompletionTokens: 8192,
    },

    // Reasoning Models - specialized for complex problem solving
    {
      name: 'deepseek-reasoner',
      label: 'DeepSeek Reasoner',
      provider: 'Deepseek',
      maxTokenAllowed: 64000, // Reasoning model with moderate context
      maxCompletionTokens: 8192,
    },

    // Legacy V2.5 Models (for compatibility) - 32k context
    {
      name: 'deepseek-chat-v2.5',
      label: 'DeepSeek V2.5 Chat (Legacy)',
      provider: 'Deepseek',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'deepseek-coder-v2.5',
      label: 'DeepSeek V2.5 Coder (Legacy)',
      provider: 'Deepseek',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 4096,
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
      defaultApiTokenKey: 'DEEPSEEK_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(model);
  }
}
