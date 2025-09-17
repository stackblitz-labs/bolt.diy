import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class HuggingFaceProvider extends BaseProvider {
  name = 'HuggingFace';
  getApiKeyLink = 'https://huggingface.co/settings/tokens';

  config = {
    apiTokenKey: 'HuggingFace_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen2.5-Coder-32B-Instruct (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: '01-ai/Yi-1.5-34B-Chat',
      label: 'Yi-1.5-34B-Chat (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: 'codellama/CodeLlama-34b-Instruct-hf',
      label: 'CodeLlama-34b-Instruct (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: 'NousResearch/Hermes-3-Llama-3.1-8B',
      label: 'Hermes-3-Llama-3.1-8B (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: 'Qwen/Qwen2.5-72B-Instruct',
      label: 'Qwen2.5-72B-Instruct (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: 'meta-llama/Llama-3.1-70B-Instruct',
      label: 'Llama-3.1-70B-Instruct (HuggingFace)',
      provider: 'HuggingFace',
      maxTokenAllowed: 8000,
    },
    {
      name: 'meta-llama/Llama-3.1-405B',
      label: 'Llama-3.1-405B (HuggingFace)',
      provider: 'HuggingFace',
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
      defaultApiTokenKey: 'HuggingFace_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://api-inference.huggingface.co/v1/',
      apiKey,
    });

    return openai(model);
  }
}
