import type { LanguageModel } from 'ai';
import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class CrowllmProvider extends BaseProvider {
  name = 'CrowLLM';
  getApiKeyLink = 'https://crowllm.com';

  config = {
    apiTokenKey: 'CROWLLM_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'deepseek-v4-flash',
      label: 'DeepSeek V4 Flash',
      provider: 'CrowLLM',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'glm-5.3',
      label: 'GLM 5.3',
      provider: 'CrowLLM',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 32768,
    },
    {
      name: 'kimi-k3',
      label: 'Kimi K3',
      provider: 'CrowLLM',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32768,
    },
    {
      name: 'claude-opus-4-7',
      label: 'Claude Opus 4.7',
      provider: 'CrowLLM',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 32000,
    },
    {
      name: 'gemini-3.7-flash',
      label: 'Gemini 3.7 Flash',
      provider: 'CrowLLM',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 65536,
    },
    {
      name: 'grok-4.7:free',
      label: 'Grok 4.7 (free)',
      provider: 'CrowLLM',
      maxTokenAllowed: 256000,
      maxCompletionTokens: 32768,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'CROWLLM_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    // CrowLLM is OpenAI-compatible; one key covers every served model id.
    return getOpenAILikeModel('https://crowllm.com/v1', apiKey, model);
  }
}
