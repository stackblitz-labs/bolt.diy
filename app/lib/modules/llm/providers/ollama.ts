import { wrapLanguageModel, type LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import { getEnv } from '~/lib/modules/llm/env';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { logger } from '~/utils/logger';

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

export interface OllamaApiResponse {
  models: OllamaModel[];
}

export default class OllamaProvider extends BaseProvider {
  name = 'Ollama';
  getApiKeyLink = 'https://ollama.com/download';
  labelForGetApiKey = 'Download Ollama';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'OLLAMA_API_BASE_URL',
    baseUrl: 'http://127.0.0.1:11434',
  };

  staticModels: ModelInfo[] = [];

  getDefaultNumCtx(serverEnv?: Env): number {
    const envRecord = this.convertEnvToRecord(serverEnv);
    const configured = Number(envRecord.DEFAULT_NUM_CTX || process.env.DEFAULT_NUM_CTX || getEnv().DEFAULT_NUM_CTX);

    return Number.isSafeInteger(configured) && configured > 0 ? configured : 65_536;
  }

  private _resolveBaseUrl(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): string {
    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for Ollama provider');
    }

    baseUrl = this.resolveDockerUrl(baseUrl, serverEnv);

    return baseUrl;
  }

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const baseUrl = this._resolveBaseUrl(apiKeys, settings, serverEnv);

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as OllamaApiResponse;

      return data.models.map((model: OllamaModel) => ({
        name: model.name,
        label: `${model.name} (${model.details.parameter_size})`,
        provider: this.name,
        maxTokenAllowed: 8000,
      }));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        logger.warn('Ollama model fetch timed out — is Ollama running?');

        return [];
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.warn(`Ollama not reachable at ${baseUrl} — is Ollama running?`);

        return [];
      }

      logger.error('Error fetching Ollama models:', error);

      return [];
    }
  }

  getModelInstance: (options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModel = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    const baseUrl = this._resolveBaseUrl(apiKeys, providerSettings?.[this.name], envRecord);

    logger.debug('Ollama Base Url used: ', baseUrl);

    const ollamaProvider = createOllama({
      baseURL: `${baseUrl}/api`,
    });

    const numCtx = this.getDefaultNumCtx(serverEnv);

    return wrapLanguageModel({
      model: ollamaProvider.chat(model),
      middleware: {
        specificationVersion: 'v4',

        // The chat adapter reads generation settings from providerOptions on each call.
        transformParams: async ({ params }) => {
          const ollama = params.providerOptions?.ollama;
          const options = ollama?.options;
          const overrides = options && typeof options === 'object' && !Array.isArray(options) ? options : {};

          return {
            ...params,
            providerOptions: {
              ...params.providerOptions,
              ollama: { ...ollama, options: { num_ctx: numCtx, ...overrides } },
            },
          };
        },
      },
    });
  };
}
