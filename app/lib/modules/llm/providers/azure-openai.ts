import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const DEFAULT_API_VERSION = '2024-02-15-preview';

export default class AzureOpenAIProvider extends BaseProvider {
  name = 'AzureOpenAI';
  getApiKeyLink = 'https://learn.microsoft.com/azure/ai-services/openai/';
  labelForGetApiKey = 'Azure OpenAI API key';

  config = {
    baseUrlKey: 'AZURE_OPENAI_BASE_URL',
    apiTokenKey: 'AZURE_OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'gpt-4o',
      label: 'GPT-4o (deployment name)',
      provider: 'AzureOpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'gpt-4o-mini',
      label: 'GPT-4o Mini (deployment name)',
      provider: 'AzureOpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'gpt-4-turbo',
      label: 'GPT-4 Turbo (deployment name)',
      provider: 'AzureOpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'gpt-35-turbo',
      label: 'GPT-3.5 Turbo (deployment name)',
      provider: 'AzureOpenAI',
      maxTokenAllowed: 16000,
      maxCompletionTokens: 4096,
    },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'AZURE_OPENAI_BASE_URL',
      defaultApiTokenKey: 'AZURE_OPENAI_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    const apiVersion =
      providerSettings?.[this.name]?.apiVersion ||
      (serverEnv as any)?.AZURE_OPENAI_API_VERSION ||
      process?.env?.AZURE_OPENAI_API_VERSION ||
      DEFAULT_API_VERSION;

    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const deploymentBaseUrl = normalizedBaseUrl.includes('/openai/deployments/')
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/openai/deployments/${encodeURIComponent(model)}`;

    const openai = createOpenAI({
      baseURL: deploymentBaseUrl,
      apiKey,
      compatibility: 'compatible',
      headers: {
        'api-key': apiKey,
      },
      fetch: async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);

        if (!url.searchParams.has('api-version')) {
          url.searchParams.set('api-version', apiVersion);
        }

        const headers = new Headers(init?.headers);
        headers.delete('Authorization');
        headers.set('api-key', apiKey);

        return fetch(url.toString(), { ...init, headers });
      },
    });

    return openai(model);
  }
}
