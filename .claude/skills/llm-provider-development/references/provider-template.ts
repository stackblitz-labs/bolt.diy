/**
 * LLM Provider Template
 * 
 * Copy this file to app/lib/modules/llm/providers/<your-provider>.ts
 * and customize for your provider.
 * 
 * Don't forget to export in registry.ts!
 */

import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { LanguageModelV1 } from 'ai';
import type { IProviderSetting } from '~/types/model';
// Import your Vercel AI SDK provider
// import { createMyProvider } from '@ai-sdk/my-provider';
// Or use OpenAI-compatible wrapper:
import { createOpenAI } from '@ai-sdk/openai';

export default class MyProvider extends BaseProvider {
  /**
   * Provider display name - used as key in registry and UI
   * Must be unique across all providers
   */
  name = 'MyProvider';

  /**
   * URL where users can get an API key
   * Shown in settings UI
   */
  getApiKeyLink = 'https://my-provider.com/api-keys';

  /**
   * Optional: Custom label for the API key link
   */
  labelForGetApiKey = 'Get MyProvider API Key';

  /**
   * Configuration for API key and base URL lookup
   */
  config = {
    // Environment variable name for API key
    apiTokenKey: 'MY_PROVIDER_API_KEY',
    
    // Optional: Environment variable for custom base URL
    baseUrlKey: 'MY_PROVIDER_BASE_URL',
    
    // Optional: Default base URL (if not using env var)
    baseUrl: 'https://api.my-provider.com/v1',
  };

  /**
   * Static models - always available without API call
   * These serve as fallbacks when dynamic model fetching fails
   */
  staticModels: ModelInfo[] = [
    {
      name: 'my-model-small',           // API model identifier
      label: 'My Model Small',           // Display name in UI
      provider: 'MyProvider',            // MUST match this.name
      maxTokenAllowed: 32000,            // Context window (input tokens)
      maxCompletionTokens: 4096,         // Max output tokens
    },
    {
      name: 'my-model-large',
      label: 'My Model Large (128k)',
      provider: 'MyProvider',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
  ];

  /**
   * Create a model instance for streaming
   * This is called when a user selects this provider's model
   * 
   * REQUIRED: Must return a LanguageModelV1 compatible instance
   */
  getModelInstance = (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 => {
    const { apiKeys, providerSettings, serverEnv, model } = options;

    // Use helper to resolve API key and base URL from multiple sources
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'MY_PROVIDER_BASE_URL',
      defaultApiTokenKey: 'MY_PROVIDER_API_KEY',
    });

    // Option 1: Use dedicated Vercel AI SDK provider
    // const provider = createMyProvider({ apiKey });
    // return provider(model);

    // Option 2: Use OpenAI-compatible wrapper (most common)
    const openai = createOpenAI({
      baseURL: baseUrl || this.config.baseUrl,
      apiKey,
    });

    return openai(model);
  };

  /**
   * Fetch available models from provider API
   * 
   * OPTIONAL: Implement if the provider has an API to list models
   * Results are cached automatically by BaseProvider
   * 
   * If not implemented, only staticModels will be available
   */
  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'MY_PROVIDER_BASE_URL',
      defaultApiTokenKey: 'MY_PROVIDER_API_KEY',
    });

    // Return empty if no API key (graceful degradation)
    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl || this.config.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json() as { data: Array<{ id: string; context_window?: number }> };
      
      // Filter out models already in staticModels
      const staticIds = this.staticModels.map(m => m.name);

      return data.data
        .filter((model) => !staticIds.includes(model.id))
        .map((model) => ({
          name: model.id,
          label: this.formatModelLabel(model.id),
          provider: this.name,
          maxTokenAllowed: model.context_window || 32000,
          maxCompletionTokens: this.inferMaxCompletionTokens(model.id),
        }));
    } catch (error) {
      // Log but don't throw - static models will still be available
      console.error(`[${this.name}] Failed to fetch dynamic models:`, error);
      return [];
    }
  }

  /**
   * Helper: Format model ID into display label
   */
  private formatModelLabel(modelId: string): string {
    // Example: "my-model-v2-32k" -> "My Model V2 (32k)"
    return modelId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Helper: Infer max completion tokens from model ID
   */
  private inferMaxCompletionTokens(modelId: string): number {
    if (modelId.includes('large')) return 8192;
    if (modelId.includes('small')) return 4096;
    return 4096; // default
  }
}
