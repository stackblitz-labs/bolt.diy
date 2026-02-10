import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { createOpenAI } from '@ai-sdk/openai';
import crypto from 'node:crypto';

export default class ZaiProvider extends BaseProvider {
  name = 'Z.ai';
  getApiKeyLink = 'https://open.bigmodel.cn/usercenter/apikeys';

  config = {
    baseUrlKey: 'ZAI_BASE_URL',
    apiTokenKey: 'ZAI_API_KEY',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4', //Dedicated endpoint for Coding Plan
  };

  staticModels: ModelInfo[] = [
    {
      name: 'glm-4.6',
      label: 'GLM-4.6 (200K)',
      provider: 'Z.ai',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 65536,
    },
    {
      name: 'glm-4.5',
      label: 'GLM-4.5 (128K)',
      provider: 'Z.ai',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 65536,
    },
    {
      name: 'glm-4.5-flash',
      label: 'GLM-4.5 Flash (128K)',
      provider: 'Z.ai',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 65536,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ZAI_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing Api Key configuration for ${this.name} provider`);
    }

    const token = this._generateToken(apiKey);

    if (!this._isValidToken(token)) {
      throw new Error(`Invalid API key format for ${this.name} provider`);
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const res = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      // Filter out static models and only include GLM models
      const data =
        res.data?.filter(
          (model: any) =>
            model.object === 'model' && model.id?.startsWith('glm-') && !staticModelIds.includes(model.id),
        ) || [];

      return data.map((m: any) => {
        let contextWindow = 128000;
        let maxCompletionTokens = 65536;

        if (m.id?.includes('glm-4.6')) {
          contextWindow = 200000;
          maxCompletionTokens = 65536;
        } else if (m.id?.includes('glm-4.5')) {
          contextWindow = 128000;
          maxCompletionTokens = 65536;
        } else if (m.id?.includes('glm-4')) {
          contextWindow = 128000;
          maxCompletionTokens = 8192;
        } else if (m.id?.includes('glm-3')) {
          contextWindow = 32000;
          maxCompletionTokens = 4096;
        }

        return {
          name: m.id,
          label: `${m.id} (${Math.floor(contextWindow / 1000)}k context)`,
          provider: this.name,
          maxTokenAllowed: contextWindow,
          maxCompletionTokens,
        };
      });
    } catch (error) {
      console.error(`Failed to fetch dynamic models for ${this.name}:`, error);
      return [];
    }
  }

  private _generateToken(apiKey: string): string {
    try {
      const [id, secret] = apiKey.split('.');

      if (!id || !secret) {
        throw new Error(`Invalid API key format for ${this.name}. Expected: id.secret`);
      }

      const now = Date.now();
      const payload = {
        apiKey: id,
        exp: now + 3600 * 1000,
        timestamp: now,
      };

      const header = { alg: 'HS256', sign_type: 'SIGN' };

      const base64Url = (obj: any) =>
        Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(base64Url(header) + '.' + base64Url(payload))
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

      return `${base64Url(header)}.${base64Url(payload)}.${signature}`;
    } catch (error) {
      console.error(`Failed to generate JWT token for ${this.name}:`, error);
      throw new Error(`Failed to generate JWT token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validates JWT token format
   */
  private _isValidToken(token: string): boolean {
    try {
      const parts = token.split('.');
      return parts.length === 3 && parts.every((part) => part.length > 0);
    } catch {
      return false;
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'ZAI_BASE_URL',
      defaultApiTokenKey: 'ZAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const token = this._generateToken(apiKey);
    const zaiClient = createOpenAI({
      baseURL: baseUrl,
      apiKey: token,
    });

    return zaiClient(model);
  }
}
