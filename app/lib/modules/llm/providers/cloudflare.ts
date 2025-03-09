import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class CloudflareProvider extends BaseProvider {
  name = 'Cloudflare';
  getApiKeyLink = 'https://dash.cloudflare.com/profile/api-tokens';

  config = {
    apiTokenKey: 'CLOUDFLARE_API_TOKEN',
    accountIdKey: 'CLOUDFLARE_ACCOUNT_ID',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    const accountId = serverEnv?.CLOUDFLARE_ACCOUNT_ID || process?.env?.CLOUDFLARE_ACCOUNT_ID;

    if (!apiKey || !accountId) {
      return [];
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = (await response.json()) as { result: Array<{ id: string }> };
      return data.result.map((model: any) => ({
        name: model.name,
        label: model.name,
        provider: this.name,
        maxTokenAllowed: 100000,
      }));
    } catch (error) {
      console.error('Error fetching Cloudflare models:', error);
      return [];
    }
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
      defaultApiTokenKey: 'CLOUDFLARE_API_TOKEN',
    });

    const accountId = serverEnv?.CLOUDFLARE_ACCOUNT_ID || process?.env?.CLOUDFLARE_ACCOUNT_ID;

    if (!apiKey) {
      throw new Error(`Missing API token for ${this.name} provider`);
    }

    if (!accountId) {
      throw new Error(`Missing Account ID for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
      apiKey,
    });

    return openai(model);
  }
}
