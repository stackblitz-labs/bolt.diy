import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

export class AnthropicProvider extends BaseProvider {
  name = 'Anthropic';
  getApiKeyLink = 'https://console.anthropic.com/settings/keys';

  config = {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  };

  staticModels: ModelInfo[] = [
    /*
     * Claude Opus 4.1: Most powerful model for coding and reasoning
     * Released August 5, 2025
     */
    {
      name: 'claude-opus-4-1-20250805',
      label: 'Claude Opus 4.1',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
      supportsSmartAI: false, // Base model without SmartAI
    },
    {
      name: 'claude-opus-4-1-20250805-smartai',
      label: 'Claude Opus 4.1 (SmartAI)',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
      supportsSmartAI: true,
      isSmartAIEnabled: true,
    },

    /*
     * Claude Sonnet 4: Hybrid instant/extended response model
     * Released May 14, 2025
     */
    {
      name: 'claude-sonnet-4-20250514',
      label: 'Claude Sonnet 4',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
      supportsSmartAI: false, // Base model without SmartAI
    },
    {
      name: 'claude-sonnet-4-20250514-smartai',
      label: 'Claude Sonnet 4 (SmartAI)',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 64000,
      supportsSmartAI: true,
      isSmartAIEnabled: true,
    },

    /*
     * Essential fallback models - only the most stable/reliable ones
     * Claude 3.5 Sonnet: 200k context, excellent for complex reasoning and coding
     */
    {
      name: 'claude-3-5-sonnet-20241022',
      label: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 8192,
      supportsSmartAI: false, // Base model without SmartAI
    },
    {
      name: 'claude-3-5-sonnet-20241022-smartai',
      label: 'Claude 3.5 Sonnet (SmartAI)',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 8192,
      supportsSmartAI: true,
      isSmartAIEnabled: true,
    },

    // Claude 3 Haiku: 200k context, fastest and most cost-effective
    {
      name: 'claude-3-haiku-20240307',
      label: 'Claude 3 Haiku',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 4096,
      supportsSmartAI: false, // Base model without SmartAI
    },
    {
      name: 'claude-3-haiku-20240307-smartai',
      label: 'Claude 3 Haiku (SmartAI)',
      provider: 'Anthropic',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 4096,
      supportsSmartAI: true,
      isSmartAIEnabled: true,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.anthropic.com/v1/models`, {
      headers: {
        'x-api-key': `${apiKey}`,
        ['anthropic-version']: '2023-06-01',
        ['Content-Type']: 'application/json',
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter((model: any) => model.type === 'model' && !staticModelIds.includes(model.id));

    return data.map((m: any) => {
      // Get accurate context window from Anthropic API
      let contextWindow = 32000; // default fallback

      // Anthropic provides max_tokens in their API response
      if (m.max_tokens) {
        contextWindow = m.max_tokens;
      } else if (m.id?.includes('claude-3-5-sonnet')) {
        contextWindow = 200000; // Claude 3.5 Sonnet has 200k context
      } else if (m.id?.includes('claude-3-haiku')) {
        contextWindow = 200000; // Claude 3 Haiku has 200k context
      } else if (m.id?.includes('claude-3-opus')) {
        contextWindow = 200000; // Claude 3 Opus has 200k context
      } else if (m.id?.includes('claude-3-sonnet')) {
        contextWindow = 200000; // Claude 3 Sonnet has 200k context
      }

      // Determine max completion tokens based on model
      let maxCompletionTokens = 4096; // default fallback

      if (m.id?.includes('claude-sonnet-4') || m.id?.includes('claude-opus-4')) {
        maxCompletionTokens = 64000;
      } else if (m.id?.includes('claude-3-7-sonnet')) {
        maxCompletionTokens = 64000;
      } else if (m.id?.includes('claude-3-5-sonnet')) {
        maxCompletionTokens = 8192;
      } else if (m.id?.includes('claude-3-haiku')) {
        maxCompletionTokens = 4096;
      } else if (m.id?.includes('claude-3-opus')) {
        maxCompletionTokens = 4096;
      } else if (m.id?.includes('claude-3-sonnet')) {
        maxCompletionTokens = 4096;
      }

      return {
        name: m.id,
        label: `${m.display_name} (${Math.floor(contextWindow / 1000)}k context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
        supportsSmartAI: true, // All Anthropic models support SmartAI
      };
    });
  }

  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1 = (options) => {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'ANTHROPIC_API_KEY',
    });

    if (!apiKey) {
      throw `Missing API key for ${this.name} provider`;
    }

    const anthropic = createAnthropic({
      apiKey,
      baseURL: baseUrl || 'https://api.anthropic.com/v1',
    });

    // Handle SmartAI variant by using the base model name
    const actualModel = model.replace('-smartai', '');

    return anthropic(actualModel);
  };
}
