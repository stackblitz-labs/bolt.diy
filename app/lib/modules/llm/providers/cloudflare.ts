import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class CloudflareProvider extends BaseProvider {
  name = 'Cloudflare';
  getApiKeyLink = 'https://dash.cloudflare.com/profile/api-tokens';
  labelForGetApiKey = 'Get Cloudflare API Token';

  config = {
    apiTokenKey: 'CLOUDFLARE_API_TOKEN',
    baseUrlKey: 'CLOUDFLARE_ACCOUNT_ID', // We'll use this to store Account ID
  };

  staticModels: ModelInfo[] = [
    /*
     * Essential fallback models - only the most stable/reliable ones
     * OpenAI GPT models hosted on Cloudflare Workers AI
     */
    {
      name: '@cf/openai/gpt-oss-120b',
      label: 'GPT OSS 120B (Production)',
      provider: 'Cloudflare',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },

    // OpenAI GPT 20B: Lower latency model
    {
      name: '@cf/openai/gpt-oss-20b',
      label: 'GPT OSS 20B (Fast)',
      provider: 'Cloudflare',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },

    // Meta Llama 3.1 8B: Multilingual dialogue optimized
    {
      name: '@cf/meta/llama-3.1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'Cloudflare',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Meta Llama 3.3 70B: Quantized for performance
    {
      name: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      label: 'Llama 3.3 70B (Fast)',
      provider: 'Cloudflare',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },

    // Mistral with vision capabilities
    {
      name: '@cf/mistral/mistral-small-3.1-24b-instruct',
      label: 'Mistral Small 24B',
      provider: 'Cloudflare',
      maxTokenAllowed: 32000,
      maxCompletionTokens: 8192,
    },

    // Google Gemma multimodal
    {
      name: '@cf/google/gemma-3-12b-it',
      label: 'Gemma 3 12B IT',
      provider: 'Cloudflare',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey, baseUrl: accountId } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'CLOUDFLARE_ACCOUNT_ID',
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    if (!apiKey || !accountId) {
      throw new Error(`Missing API key or Account ID for ${this.name} provider`);
    }

    try {
      /*
       * Note: Cloudflare doesn't provide a direct models list API like OpenAI
       * We'll use a predefined list of known models with their specifications
       */
      const knownModels = await this._getKnownCloudflareModels();

      // Filter out models that are already in staticModels
      const staticModelNames = this.staticModels.map((m) => m.name);
      const dynamicModels = knownModels.filter((model) => !staticModelNames.includes(model.name));

      return dynamicModels;
    } catch (error: any) {
      console.error(`Failed to fetch dynamic models for ${this.name}:`, error.message);
      return [];
    }
  }

  private async _getKnownCloudflareModels(): Promise<ModelInfo[]> {
    /*
     * Since Cloudflare doesn't provide a models list API, we maintain a comprehensive list
     * of available models with their specifications
     */
    return [
      // Additional Llama models
      {
        name: '@cf/meta/llama-4-scout-17b-16e-instruct',
        label: 'Llama 4 Scout 17B (Multimodal)',
        provider: 'Cloudflare',
        maxTokenAllowed: 128000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/meta/llama-3.2-90b-vision-instruct',
        label: 'Llama 3.2 90B Vision',
        provider: 'Cloudflare',
        maxTokenAllowed: 128000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/meta/llama-3.2-11b-vision-instruct',
        label: 'Llama 3.2 11B Vision',
        provider: 'Cloudflare',
        maxTokenAllowed: 128000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/meta/llama-3.2-3b-instruct',
        label: 'Llama 3.2 3B Instruct',
        provider: 'Cloudflare',
        maxTokenAllowed: 128000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/meta/llama-3.2-1b-instruct',
        label: 'Llama 3.2 1B Instruct',
        provider: 'Cloudflare',
        maxTokenAllowed: 128000,
        maxCompletionTokens: 8192,
      },

      // Additional Mistral models
      {
        name: '@cf/mistral/mistral-7b-instruct-v0.1',
        label: 'Mistral 7B Instruct v0.1',
        provider: 'Cloudflare',
        maxTokenAllowed: 32000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@hf/nousresearch/hermes-2-pro-mistral-7b',
        label: 'Hermes 2 Pro Mistral 7B',
        provider: 'Cloudflare',
        maxTokenAllowed: 32000,
        maxCompletionTokens: 8192,
      },

      // Additional Google models
      {
        name: '@cf/google/gemma-7b-it',
        label: 'Gemma 7B IT',
        provider: 'Cloudflare',
        maxTokenAllowed: 8192,
        maxCompletionTokens: 4096,
      },
      {
        name: '@cf/google/gemma-2b-it',
        label: 'Gemma 2B IT',
        provider: 'Cloudflare',
        maxTokenAllowed: 8192,
        maxCompletionTokens: 4096,
      },

      // Qwen models
      {
        name: '@cf/qwen/qwen2.5-coder-7b-instruct',
        label: 'Qwen 2.5 Coder 7B',
        provider: 'Cloudflare',
        maxTokenAllowed: 32000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/qwen/qwen2.5-14b-instruct',
        label: 'Qwen 2.5 14B Instruct',
        provider: 'Cloudflare',
        maxTokenAllowed: 32000,
        maxCompletionTokens: 8192,
      },

      // Microsoft models
      {
        name: '@cf/microsoft/phi-2',
        label: 'Microsoft Phi-2',
        provider: 'Cloudflare',
        maxTokenAllowed: 8192,
        maxCompletionTokens: 4096,
      },

      // Additional specialized models
      {
        name: '@cf/defog/sqlcoder-7b-2',
        label: 'SQLCoder 7B v2',
        provider: 'Cloudflare',
        maxTokenAllowed: 16000,
        maxCompletionTokens: 8192,
      },
      {
        name: '@cf/openchat/openchat-3.5-0106',
        label: 'OpenChat 3.5',
        provider: 'Cloudflare',
        maxTokenAllowed: 8192,
        maxCompletionTokens: 4096,
      },
    ];
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey, baseUrl: accountId } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'CLOUDFLARE_ACCOUNT_ID',
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    if (!apiKey || !accountId) {
      throw new Error(`Missing API key or Account ID for ${this.name} provider`);
    }

    // Cloudflare Workers AI uses OpenAI-compatible API
    const openai = createOpenAI({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      apiKey,
    });

    return openai(model);
  }
}
