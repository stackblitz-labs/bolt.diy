import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class GithubProvider extends BaseProvider {
  name = 'Github';
  getApiKeyLink = 'https://github.com/settings/personal-access-tokens';

  config = {
    apiTokenKey: 'GITHUB_API_KEY',
  };

  // find more in https://github.com/marketplace?type=models
  staticModels: ModelInfo[] = [
    { name: 'gpt-4o', label: 'GPT-4o', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'o1-mini', label: 'o1-mini', provider: 'Github', maxTokenAllowed: 4000 }, // requires Copilot Pro
    { name: 'o1-preview', label: 'o1-preview', provider: 'Github', maxTokenAllowed: 4000 }, // requires Copilot Pro
    { name: 'o1', label: 'o1', provider: 'Github', maxTokenAllowed: 4000 },
    { name: 'o3-mini', label: 'o3-mini', provider: 'Github', maxTokenAllowed: 4000 }, // requires Copilot Pro
    { name: 'DeepSeek-V3', label: 'DeepSeek-V3', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'DeepSeek-R1', label: 'DeepSeek-R1', provider: 'Github', maxTokenAllowed: 4000 },
    { name: 'Llama-3.3-70B-Instruct', label: 'Llama-3.3-70B-Instruct', provider: 'Github', maxTokenAllowed: 8000 },
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
      defaultApiTokenKey: 'GITHUB_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey,
    });

    return openai(model);
  }
}
