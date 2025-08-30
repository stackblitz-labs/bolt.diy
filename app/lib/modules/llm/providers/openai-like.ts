import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAILike';
  getApiKeyLink = undefined;

  config = {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
    modelKey: 'OPENAI_LIKE_API_MODELS',
  };

  staticModels: ModelInfo[] = [];

  getEnvDefinedModels(serverEnv: Record<string, string> = {}): ModelInfo[] {
    const models =
      serverEnv[this.config.modelKey] ||
      process.env[this.config.modelKey] ||
      import.meta.env[this.config.modelKey] ||
      '';
    console.debug(`${this.name}: ${this.config.modelKey}=${models}`);

    const mklabel = (model: string) => {
      let parts = model.split('/').reverse() || [];
      parts = parts.filter((p) => p && !p.includes('accounts') && !p.includes('models'));

      let label = parts.join('-');

      if (parts.length >= 2) {
        label = `${parts.shift()} (${parts.join(', ')})`;
      }

      return label.toLowerCase().replace(/\b\w/g, (match) => match.toUpperCase());
    };

    const ret =
      models?.split(';').map((model: string) => {
        const parts = model.split(':');
        const name = (parts.length && parts.shift()?.trim()) || 'parse-error';
        const ret = {
          name,
          label: mklabel(name),
          provider: this.name,
          maxTokenAllowed: parseInt(parts.shift() || '0'),
        };

        return ret;
      }) || [];

    console.debug(`${this.name}: Parsed Models: `, ...ret);

    return ret;
  }

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ContentType: 'application/json',
      },
    });

    let ret = [];

    try {
      const json = (await response.json()) as any;
      ret = json.data.map((model: any) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: 8000,
      }));
    } catch {
      if (response.headers.has('x-error-message')) {
        const xerr = response.headers.get('x-error-message');
        console.debug(`${this.name}: ${xerr}`);
        ret = this.getEnvDefinedModels(serverEnv);
      }
    }

    return ret;
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
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
