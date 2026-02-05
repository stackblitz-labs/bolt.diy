import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export default class VertexAIProvider extends BaseProvider {
  name = 'VertexAI';
  getApiKeyLink = 'https://cloud.google.com/vertex-ai/generative-ai/docs';
  labelForGetApiKey = 'Vertex access token';

  config = {
    baseUrlKey: 'VERTEX_AI_BASE_URL',
    apiTokenKey: 'VERTEX_AI_ACCESS_TOKEN',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'gemini-1.5-pro',
      label: 'Gemini 1.5 Pro (Vertex)',
      provider: 'VertexAI',
      maxTokenAllowed: 2000000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'gemini-1.5-flash',
      label: 'Gemini 1.5 Flash (Vertex)',
      provider: 'VertexAI',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash (Vertex)',
      provider: 'VertexAI',
      maxTokenAllowed: 1000000,
      maxCompletionTokens: 8192,
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
      defaultBaseUrlKey: 'VERTEX_AI_BASE_URL',
      defaultApiTokenKey: 'VERTEX_AI_ACCESS_TOKEN',
    });

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    const vertex = createGoogleGenerativeAI({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return vertex(model);
  }
}
