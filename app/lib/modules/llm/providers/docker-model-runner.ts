import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { logger } from '~/utils/logger';

export default class DockerModelRunnerProvider extends BaseProvider {
  name = 'DockerModelRunner';
  getApiKeyLink = 'https://docs.docker.com/ai/model-runner/';
  labelForGetApiKey = 'Enable Model Runner';
  icon = 'i-ph:docker-logo';

  config = {
    baseUrlKey: 'DMR_API_BASE_URL',
    baseUrl: 'http://localhost:12434',
  };

  staticModels: ModelInfo[] = [];

  private _normalizeBaseUrl(baseUrl: string, isDocker: boolean): string {
    let url = baseUrl;

    if (isDocker) {
      url = url.replace('localhost', 'host.docker.internal');
      url = url.replace('127.0.0.1', 'host.docker.internal');
    }

    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    return url;
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
      defaultBaseUrlKey: 'DMR_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for Docker Model Runner provider');
    }

    const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true' || serverEnv?.RUNNING_IN_DOCKER === 'true';
    const normalized = this._normalizeBaseUrl(baseUrl, !!isDocker);

    const modelsUrl = `${normalized}/engines/v1/models`;

    const response = await fetch(modelsUrl);

    if (!response.ok) {
      throw new Error(`DMR GET /engines/v1/models failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data?: Array<{ id: string }>; [key: string]: any };
    const items = data?.data || [];

    return items.map((m) => ({
      name: m.id,
      label: m.id,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'DMR_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for Docker Model Runner provider');
    }

    const envRecord = Object.entries(serverEnv || ({} as any)).reduce(
      (acc, [k, v]) => {
        acc[k] = String(v);
        return acc;
      },
      {} as Record<string, string>,
    );

    const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true' || envRecord?.RUNNING_IN_DOCKER === 'true';
    const normalized = this._normalizeBaseUrl(baseUrl, !!isDocker);

    logger.debug('Docker Model Runner Base Url used: ', normalized);

    const openai = createOpenAI({
      baseURL: `${normalized}/engines/v1`,
      apiKey: '',
    });

    return openai(model);
  }
}