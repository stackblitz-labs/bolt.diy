import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PollinationsProvider');

// Define response type for the Pollinations API
interface PollinationsModelResponse {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
    context_length?: number;
  }>;
  object: string;
}

export default class PollinationsProvider extends BaseProvider {
  name = 'Pollinations';
  getApiKeyLink = 'https://pollinations.ai/';
  labelForGetApiKey = 'Visit Pollinations.ai';
  icon = 'i-ph:flower-fill';

  config = {
    baseUrlKey: 'POLLINATIONS_API_BASE_URL',
  };

  constructor() {
    super();
    logger.info('Initializing Pollinations Provider');
  }

  staticModels: ModelInfo[] = [
    {
      name: 'haiku',
      label: 'Haiku',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'mistral-medium',
      label: 'Mistral Medium',
      provider: 'Pollinations',
      maxTokenAllowed: 8000,
    },
    {
      name: 'llama3-8b',
      label: 'Llama 3 8B',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'llama3-70b',
      label: 'Llama 3 70B',
      provider: 'Pollinations',
      maxTokenAllowed: 8000,
    },
    {
      name: 'phi-3-mini',
      label: 'Phi-3 Mini',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'phi-3-medium',
      label: 'Phi-3 Medium',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'gemma-7b',
      label: 'Gemma 7B',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'mistral-small',
      label: 'Mistral Small',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'mistral-large',
      label: 'Mistral Large',
      provider: 'Pollinations',
      maxTokenAllowed: 8192,
    },
    {
      name: 'gpt-4o',
      label: 'GPT-4o',
      provider: 'Pollinations',
      maxTokenAllowed: 8192,
    },
    {
      name: 'claude-3-haiku',
      label: 'Claude 3 Haiku',
      provider: 'Pollinations',
      maxTokenAllowed: 4096,
    },
    {
      name: 'claude-3-sonnet',
      label: 'Claude 3 Sonnet',
      provider: 'Pollinations',
      maxTokenAllowed: 8192,
    },
    {
      name: 'claude-3-opus',
      label: 'Claude 3 Opus',
      provider: 'Pollinations',
      maxTokenAllowed: 32768,
    },
    {
      name: 'deepseek-coder',
      label: 'DeepSeek Coder',
      provider: 'Pollinations',
      maxTokenAllowed: 8192,
    },
    {
      name: 'qwen-72b',
      label: 'Qwen 72B',
      provider: 'Pollinations',
      maxTokenAllowed: 8192,
    },
  ];

  // You can also add a dynamic models function if needed
  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    logger.info('Getting dynamic models for Pollinations');

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'POLLINATIONS_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    // Default base URL if not provided
    baseUrl = baseUrl || 'https://text.pollinations.ai/openai';

    try {
      // Fetch models from Pollinations API
      const response = await fetch(`${baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch models from Pollinations API: ${response.status}`);
        return this.staticModels;
      }

      const data = (await response.json()) as PollinationsModelResponse;

      if (data && Array.isArray(data.data)) {
        const models = data.data.map((model) => ({
          name: model.id,
          label: model.id.split('/').pop() || model.id,
          provider: this.name,
          maxTokenAllowed: model.context_length || 4096,
        }));

        logger.info(`Retrieved ${models.length} models from Pollinations API`);

        return models;
      }

      logger.warn('Invalid response format from Pollinations API, falling back to static models');

      return this.staticModels;
    } catch (error) {
      logger.error('Error getting dynamic models for Pollinations:', error);
      return this.staticModels;
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv?: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, providerSettings } = options;

    let { baseUrl } = this.getProviderBaseUrlAndKey({
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'POLLINATIONS_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    // Default base URL if not provided
    baseUrl = baseUrl || 'https://text.pollinations.ai/openai';

    logger.info(`Creating OpenAI instance for Pollinations with model: ${model} at ${baseUrl}`);

    try {
      const openai = createOpenAI({
        baseURL: baseUrl,
        apiKey: 'not-needed', // No real API key required for Pollinations.ai
      });

      return openai(model);
    } catch (error) {
      logger.error(`Error creating Pollinations model instance: ${error}`);
      throw new Error(`Failed to initialize Pollinations provider: ${error}`);
    }
  }
}
