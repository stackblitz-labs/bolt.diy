import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class VSCodeLLMProvider extends BaseProvider {
  name = 'VSCodeLLM';
  getApiKeyLink =
    'https://marketplace.visualstudio.com/items?itemName=vunguyen9584.openai-compatible-vscode-llm-server';
  labelForGetApiKey = 'Download vscode-llm-server extension';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'VSCODE_LLM_API_BASE_URL', // Add baseUrlKey
    baseUrl: 'http://localhost:3775/v1/', // Default baseUrl
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'VSCODE_LLM_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl || !apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    return res.data.map((model: any) => ({
      name: model.id,
      label: model.id,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'VSCODE_LLM_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for VSCode LLM provider');
    }

    // Handle Docker case like Ollama
    if (typeof window === 'undefined') {
      const isDocker = process.env.RUNNING_IN_DOCKER === 'true';
      baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
      baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;
    }

    return getOpenAILikeModel(baseUrl, '', model);
  }
}
