import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { ollama } from 'ollama-ai-provider';
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
  };

  staticModels: ModelInfo[] = [];

  private _convertEnvToRecord(env?: Env): Record<string, string> {
    if (!env) {
      return {};
    }

    // Convert Env to a plain object with string values
    return Object.entries(env).reduce(
      (acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  getDefaultNumCtx(serverEnv?: Env): number {
    const envRecord = this._convertEnvToRecord(serverEnv);
    return envRecord.DEFAULT_NUM_CTX ? parseInt(envRecord.DEFAULT_NUM_CTX, 10) : 32768;
  }

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for OLLAMA provider');
    }

    if (typeof window === 'undefined') {
      /*
       * Running in Server
       * Backend: Check if we're running in Docker
       */
      const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true' || serverEnv?.RUNNING_IN_DOCKER === 'true';

      baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
      baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;
    }

    const response = await fetch(`${baseUrl}/api/tags`);
    const data = (await response.json()) as OllamaApiResponse;

    // console.log({ ollamamodels: data.models });

    return data.models.map((model: OllamaModel) => {
      // Estimate context window based on model family and size
      let maxTokenAllowed = 8000; // default fallback
      let maxCompletionTokens = 4096; // default completion limit

      // Determine context window based on model family
      const modelName = model.name.toLowerCase();

      if (modelName.includes('llama-3.1') || modelName.includes('llama3.1')) {
        maxTokenAllowed = 128000; // Llama 3.1 has 128k context
        maxCompletionTokens = 8192;
      } else if (modelName.includes('llama-3.2') || modelName.includes('llama3.2')) {
        maxTokenAllowed = 128000; // Llama 3.2 has 128k context
        maxCompletionTokens = 8192;
      } else if (modelName.includes('llama-3') || modelName.includes('llama3')) {
        maxTokenAllowed = 8192; // Llama 3 base has 8k context
        maxCompletionTokens = 4096;
      } else if (modelName.includes('codestral') || modelName.includes('mistral')) {
        maxTokenAllowed = 32000; // Mistral family typically 32k
        maxCompletionTokens = 8192;
      } else if (modelName.includes('gemma-2')) {
        maxTokenAllowed = 8192; // Gemma 2 has 8k context
        maxCompletionTokens = 4096;
      } else if (modelName.includes('qwen')) {
        maxTokenAllowed = 32000; // Qwen models typically 32k
        maxCompletionTokens = 8192;
      } else if (modelName.includes('phi-3')) {
        maxTokenAllowed = 128000; // Phi-3 can handle 128k
        maxCompletionTokens = 8192;
      } else if (modelName.includes('deepseek')) {
        maxTokenAllowed = 64000; // DeepSeek models typically 64k+
        maxCompletionTokens = 8192;
      }

      return {
        name: model.name,
        label: `${model.name} (${model.details.parameter_size}) - ${Math.floor(maxTokenAllowed / 1000)}k context`,
        provider: this.name,
        maxTokenAllowed,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance: (options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1 = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const envRecord = this._convertEnvToRecord(serverEnv);

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    // Backend: Check if we're running in Docker
    if (!baseUrl) {
      throw new Error('No baseUrl found for OLLAMA provider');
    }

    const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true' || envRecord.RUNNING_IN_DOCKER === 'true';
    baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
    baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;

    logger.debug('Ollama Base Url used: ', baseUrl);

    const ollamaInstance = ollama(model, {
      numCtx: this.getDefaultNumCtx(serverEnv),
    }) as LanguageModelV1 & { config: any };

    ollamaInstance.config.baseURL = `${baseUrl}/api`;

    return ollamaInstance;
  };
}
