import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1, LanguageModelV1CallOptions } from 'ai';


export default class VertexAIProvider extends BaseProvider {
  name = 'VertexAI';
  getApiKeyLink = 'https://console.cloud.google.com/';

  config = {
    apiTokenKey: 'GOOGLE_ACCESS_TOKEN',
    projectIdKey: 'GOOGLE_PROJECT_ID',
    locationKey: 'GOOGLE_LOCATION',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'gemini-pro',
      label: 'Gemini Pro',
      provider: 'VertexAI',
      maxTokenAllowed: 30720,
    },
    {
      name: 'gemini-pro-vision',
      label: 'Gemini Pro Vision',
      provider: 'VertexAI',
      maxTokenAllowed: 30720,
    },
    {
      name: 'code-bison',
      label: 'Code Bison',
      provider: 'VertexAI',
      maxTokenAllowed: 6144,
    },
  ];

  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    /*
     * Vertex AI doesn't have a public API to fetch models dynamically
     * Return static models instead
     */
    return this.staticModels;
  }

  getModelInstance(options: {
    model: string;
    serverEnv?: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv = {}, apiKeys, providerSettings } = options;

    // Get all required credentials using base provider's method
    const { apiKey: accessToken, baseUrl: projectId } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv,
      defaultBaseUrlKey: 'GOOGLE_PROJECT_ID',
      defaultApiTokenKey: 'GOOGLE_ACCESS_TOKEN',
    });

    if (!accessToken) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    if (!projectId) {
      throw new Error(`Missing project ID for ${this.name} provider`);
    }

    // Get location from settings or default
    const location = apiKeys?.GOOGLE_LOCATION || 
                    providerSettings?.[this.name]?.location || 
                    serverEnv?.GOOGLE_LOCATION || 
                    'us-central1';

    const instance: LanguageModelV1 = {
      specificationVersion: 'v1',
      provider: this.name,
      modelId: model,
      defaultObjectGenerationMode: undefined,

      async doGenerate(options: LanguageModelV1CallOptions) {
        const messages = options.prompt.map((msg) => ({
          role: msg.role === 'system' ? 'user' : msg.role,
          parts: Array.isArray(msg.content)
            ? msg.content.map((part) => {
                if ('text' in part) {
                  return { text: part.text };
                }
                throw new Error(`Unsupported content type for Vertex AI`);
              })
            : [{ text: msg.content }],
        }));

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.9,
              topP: 1,
            },
          }),
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: { message?: string } };
          throw new Error(`Vertex AI API error: ${error.error?.message || 'Unknown error'}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content: {
              parts: Array<{ text: string }>;
            };
          }>;
        };

        if (!data.candidates?.[0]?.content) {
          throw new Error('No response generated from Vertex AI');
        }

        return {
          text: data.candidates[0].content.parts[0].text,
          finishReason: 'stop',
          usage: {
            promptTokens: 0,
            completionTokens: 0,
          },
          rawCall: {
            rawPrompt: messages,
            rawSettings: {},
          },
        };
      },

      async doStream(options: LanguageModelV1CallOptions) {
        const response = await this.doGenerate(options);
        return {
          stream: new ReadableStream({
            start(controller) {
              if (response.text) {
                controller.enqueue({
                  type: 'text-delta',
                  textDelta: response.text,
                });
              }
              controller.enqueue({
                type: 'finish',
                finishReason: response.finishReason,
                usage: response.usage,
              });
              controller.close();
            },
          }),
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {},
          },
        };
      },
    };

    return instance;
  }
}
