import { createOpenAI } from '@ai-sdk/openai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

const TOKENLAB_API_BASE_URL = 'https://api.tokenlab.sh/v1';

interface TokenLabModel {
  id?: string;
  owned_by?: string;
  tokenlab?: TokenLabMetadata;
  lemondata?: TokenLabMetadata;
}

interface TokenLabMetadata {
  category?: string;
  max_input_tokens?: number;
  max_output_tokens?: number;
  pricing?: {
    input_per_1m?: string | number | null;
    output_per_1m?: string | number | null;
  };
}

interface TokenLabModelsResponse {
  data?: TokenLabModel[];
}

const toNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatContextSize = (tokens: number): string => {
  if (tokens >= 1_000_000) {
    return `${Math.floor(tokens / 1_000_000)}M`;
  }

  if (tokens >= 1_000) {
    return `${Math.floor(tokens / 1_000)}k`;
  }

  return String(tokens);
};

const formatModelLabel = (id: string, owner: string | undefined, metadata: TokenLabMetadata): string => {
  const inputPrice = toNumber(metadata.pricing?.input_per_1m);
  const outputPrice = toNumber(metadata.pricing?.output_per_1m);
  const contextWindow = metadata.max_input_tokens ?? 200_000;
  const price =
    inputPrice !== undefined && outputPrice !== undefined
      ? ` - in:$${inputPrice.toFixed(2)} out:$${outputPrice.toFixed(2)}`
      : '';
  const ownerSuffix = owner ? ` (${owner})` : '';

  return `${id}${ownerSuffix}${price} - context ${formatContextSize(contextWindow)}`;
};

export default class TokenLabProvider extends BaseProvider {
  name = 'TokenLab';
  getApiKeyLink = 'https://tokenlab.sh/';

  config = {
    apiTokenKey: 'TOKENLAB_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'claude-fable-5',
      label: 'Claude Fable 5',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 128_000,
    },
    {
      name: 'claude-opus-4-8',
      label: 'Claude Opus 4.8',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 128_000,
    },
    {
      name: 'claude-sonnet-5',
      label: 'Claude Sonnet 5',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 128_000,
    },
    {
      name: 'glm-5.2',
      label: 'GLM 5.2',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 128_000,
    },
    {
      name: 'deepseek-v4-pro',
      label: 'DeepSeek V4 Pro',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 384_000,
    },
    {
      name: 'deepseek-v4-flash',
      label: 'DeepSeek V4 Flash',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 384_000,
    },
    {
      name: 'gpt-5.5',
      label: 'GPT-5.5',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 128_000,
    },
    { name: 'gpt-5.4', label: 'GPT-5.4', provider: 'TokenLab', maxTokenAllowed: 400_000, maxCompletionTokens: 128_000 },
    {
      name: 'gpt-5.4-mini',
      label: 'GPT-5.4 Mini',
      provider: 'TokenLab',
      maxTokenAllowed: 400_000,
      maxCompletionTokens: 128_000,
    },
    {
      name: 'minimax-m3',
      label: 'MiniMax M3',
      provider: 'TokenLab',
      maxTokenAllowed: 1_048_576,
      maxCompletionTokens: 524_288,
    },
    {
      name: 'kimi-k2.7-code',
      label: 'Kimi K2.7 Code',
      provider: 'TokenLab',
      maxTokenAllowed: 262_144,
      maxCompletionTokens: 131_072,
    },
    {
      name: 'qwen3.7-max',
      label: 'Qwen3.7 Max',
      provider: 'TokenLab',
      maxTokenAllowed: 991_808,
      maxCompletionTokens: 65_536,
    },
    {
      name: 'gemini-3.5-flash',
      label: 'Gemini 3.5 Flash',
      provider: 'TokenLab',
      maxTokenAllowed: 1_048_576,
      maxCompletionTokens: 65_536,
    },
    {
      name: 'gemini-3.1-flash-lite',
      label: 'Gemini 3.1 Flash Lite',
      provider: 'TokenLab',
      maxTokenAllowed: 1_048_576,
      maxCompletionTokens: 65_536,
    },
    {
      name: 'grok-4.3',
      label: 'Grok 4.3',
      provider: 'TokenLab',
      maxTokenAllowed: 1_000_000,
      maxCompletionTokens: 131_072,
    },
    {
      name: 'grok-4-fast',
      label: 'Grok 4 Fast',
      provider: 'TokenLab',
      maxTokenAllowed: 2_000_000,
      maxCompletionTokens: 16_384,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'TOKENLAB_API_KEY',
    });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${TOKENLAB_API_BASE_URL}/models`, {
        headers,
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TokenLabModelsResponse;

      return (data.data ?? [])
        .filter((model) => {
          const metadata = model.tokenlab ?? model.lemondata;
          return Boolean(model.id && metadata?.category === 'chat');
        })
        .map((model) => {
          const metadata = (model.tokenlab ?? model.lemondata)!;
          const name = model.id!;

          return {
            name,
            label: formatModelLabel(name, model.owned_by, metadata),
            provider: this.name,
            maxTokenAllowed: metadata.max_input_tokens ?? 200_000,
            maxCompletionTokens: metadata.max_output_tokens ?? 8_192,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Error getting TokenLab models:', error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'TOKENLAB_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: TOKENLAB_API_BASE_URL,
      apiKey,
    });

    return openai(model);
  }
}
