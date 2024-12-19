import Cookies from 'js-cookie';
import type { ModelInfo, OllamaApiResponse, OllamaModel } from './types';
import type { ProviderInfo, IProviderSetting } from '~/types/model';
import { createScopedLogger } from './logger';
import { logStore } from '~/lib/stores/logs';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'llama 3.2 11b';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';

const logger = createScopedLogger('Constants');

const PROVIDER_LIST: ProviderInfo[] = [
  {
    name: 'Anthropic',
    staticModels: [
      {
        name: 'claude-3-5-sonnet-latest',
        label: 'Claude 3.5 Sonnet (new)',
        provider: 'Anthropic',
        maxTokenAllowed: 8000,
      },
      {
        name: 'claude-3-5-sonnet-20240620',
        label: 'Claude 3.5 Sonnet (old)',
        provider: 'Anthropic',
        maxTokenAllowed: 8000,
      },
      {
        name: 'claude-3-5-haiku-latest',
        label: 'Claude 3.5 Haiku (new)',
        provider: 'Anthropic',
        maxTokenAllowed: 8000,
      },
      { name: 'claude-3-opus-latest', label: 'Claude 3 Opus', provider: 'Anthropic', maxTokenAllowed: 8000 },
      { name: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', provider: 'Anthropic', maxTokenAllowed: 8000 },
      { name: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', provider: 'Anthropic', maxTokenAllowed: 8000 },
    ],
    getApiKeyLink: 'https://console.anthropic.com/settings/keys',
  },
  {
    name: 'Ollama',
    staticModels: [],
    getDynamicModels: getOllamaModels,
    getApiKeyLink: 'https://ollama.com/download',
    labelForGetApiKey: 'Download Ollama',
    icon: 'i-ph:cloud-arrow-down',
  },
  {
    name: 'OpenAILike',
    staticModels: [],
    getDynamicModels: getOpenAILikeModels,
  },
  {
    name: 'Cohere',
    staticModels: [
      { name: 'command-r-plus-08-2024', label: 'Command R plus Latest', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-r-08-2024', label: 'Command R Latest', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-r-plus', label: 'Command R plus', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-r', label: 'Command R', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command', label: 'Command', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-nightly', label: 'Command Nightly', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-light', label: 'Command Light', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'command-light-nightly', label: 'Command Light Nightly', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'c4ai-aya-expanse-8b', label: 'c4AI Aya Expanse 8b', provider: 'Cohere', maxTokenAllowed: 4096 },
      { name: 'c4ai-aya-expanse-32b', label: 'c4AI Aya Expanse 32b', provider: 'Cohere', maxTokenAllowed: 4096 },
    ],
    getApiKeyLink: 'https://dashboard.cohere.com/api-keys',
  },
  {
    name: 'OpenRouter',
    staticModels: [
      { name: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI', maxTokenAllowed: 8000 },
      {
        name: 'anthropic/claude-3.5-sonnet',
        label: 'Anthropic: Claude 3.5 Sonnet (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      {
        name: 'anthropic/claude-3-haiku',
        label: 'Anthropic: Claude 3 Haiku (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      {
        name: 'deepseek/deepseek-coder',
        label: 'Deepseek-Coder V2 236B (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      {
        name: 'google/gemini-flash-1.5',
        label: 'Google Gemini Flash 1.5 (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      {
        name: 'google/gemini-pro-1.5',
        label: 'Google Gemini Pro 1.5 (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      { name: 'x-ai/grok-beta', label: 'xAI Grok Beta (OpenRouter)', provider: 'OpenRouter', maxTokenAllowed: 8000 },
      {
        name: 'mistralai/mistral-nemo',
        label: 'OpenRouter Mistral Nemo (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      {
        name: 'qwen/qwen-110b-chat',
        label: 'OpenRouter Qwen 110b Chat (OpenRouter)',
        provider: 'OpenRouter',
        maxTokenAllowed: 8000,
      },
      { name: 'cohere/command', label: 'Cohere Command (OpenRouter)', provider: 'OpenRouter', maxTokenAllowed: 4096 },
    ],
    getDynamicModels: getOpenRouterModels,
    getApiKeyLink: 'https://openrouter.ai/settings/keys',
  },
  {
    name: 'Google',
    staticModels: [
      { name: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash-002', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8b', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-1.5-pro-002', label: 'Gemini 1.5 Pro-002', provider: 'Google', maxTokenAllowed: 8192 },
      { name: 'gemini-exp-1206', label: 'Gemini exp-1206', provider: 'Google', maxTokenAllowed: 8192 },
    ],
    getApiKeyLink: 'https://aistudio.google.com/app/apikey',
  },
  {
    name: 'Groq',
    staticModels: [
      { name: 'llama-3.1-8b-instant', label: 'Llama 3.1 8b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
      { name: 'llama-3.2-11b-vision-preview', label: 'Llama 3.2 11b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
      { name: 'llama-3.2-90b-vision-preview', label: 'Llama 3.2 90b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
      { name: 'llama-3.2-3b-preview', label: 'Llama 3.2 3b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
      { name: 'llama-3.2-1b-preview', label: 'Llama 3.2 1b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
      { name: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70b (Groq)', provider: 'Groq', maxTokenAllowed: 8000 },
    ],
    getApiKeyLink: 'https://console.groq.com/keys',
  },
  {
    name: 'HuggingFace',
    staticModels: [
      {
        name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        label: 'Qwen2.5-Coder-32B-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: '01-ai/Yi-1.5-34B-Chat',
        label: 'Yi-1.5-34B-Chat (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'codellama/CodeLlama-34b-Instruct-hf',
        label: 'CodeLlama-34b-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'NousResearch/Hermes-3-Llama-3.1-8B',
        label: 'Hermes-3-Llama-3.1-8B (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        label: 'Qwen2.5-Coder-32B-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'Qwen/Qwen2.5-72B-Instruct',
        label: 'Qwen2.5-72B-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'meta-llama/Llama-3.1-70B-Instruct',
        label: 'Llama-3.1-70B-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'meta-llama/Llama-3.1-405B',
        label: 'Llama-3.1-405B (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: '01-ai/Yi-1.5-34B-Chat',
        label: 'Yi-1.5-34B-Chat (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'codellama/CodeLlama-34b-Instruct-hf',
        label: 'CodeLlama-34b-Instruct (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
      {
        name: 'NousResearch/Hermes-3-Llama-3.1-8B',
        label: 'Hermes-3-Llama-3.1-8B (HuggingFace)',
        provider: 'HuggingFace',
        maxTokenAllowed: 8000,
      },
    ],
    getApiKeyLink: 'https://huggingface.co/settings/tokens',
  },
  {
    name: 'OpenAI',
    staticModels: [
      { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', maxTokenAllowed: 8000 },
      { name: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI', maxTokenAllowed: 8000 },
      { name: 'gpt-4', label: 'GPT-4', provider: 'OpenAI', maxTokenAllowed: 8000 },
      { name: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokenAllowed: 8000 },
    ],
    getApiKeyLink: 'https://platform.openai.com/api-keys',
  },
  {
    name: 'xAI',
    staticModels: [{ name: 'grok-beta', label: 'xAI Grok Beta', provider: 'xAI', maxTokenAllowed: 8000 }],
    getApiKeyLink: 'https://docs.x.ai/docs/quickstart#creating-an-api-key',
  },
  {
    name: 'Deepseek',
    staticModels: [
      { name: 'deepseek-coder', label: 'Deepseek-Coder', provider: 'Deepseek', maxTokenAllowed: 8000 },
      { name: 'deepseek-chat', label: 'Deepseek-Chat', provider: 'Deepseek', maxTokenAllowed: 8000 },
    ],
    getApiKeyLink: 'https://platform.deepseek.com/apiKeys',
  },
  {
    name: 'Mistral',
    staticModels: [
      { name: 'open-mistral-7b', label: 'Mistral 7B', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'open-mixtral-8x7b', label: 'Mistral 8x7B', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'open-mixtral-8x22b', label: 'Mistral 8x22B', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'open-codestral-mamba', label: 'Codestral Mamba', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'open-mistral-nemo', label: 'Mistral Nemo', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'ministral-8b-latest', label: 'Mistral 8B', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'mistral-small-latest', label: 'Mistral Small', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'codestral-latest', label: 'Codestral', provider: 'Mistral', maxTokenAllowed: 8000 },
      { name: 'mistral-large-latest', label: 'Mistral Large Latest', provider: 'Mistral', maxTokenAllowed: 8000 },
    ],
    getApiKeyLink: 'https://console.mistral.ai/api-keys/',
  },
  {
    name: 'LMStudio',
    staticModels: [],
    getDynamicModels: getLMStudioModels,
    getApiKeyLink: 'https://lmstudio.ai/',
    labelForGetApiKey: 'Get LMStudio',
    icon: 'i-ph:cloud-arrow-down',
  },
  {
    name: 'Together',
    getDynamicModels: getTogetherModels,
    staticModels: [
      {
        name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        label: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        provider: 'Together',
        maxTokenAllowed: 8000,
      },
      {
        name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
        label: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
        provider: 'Together',
        maxTokenAllowed: 8000,
      },

      {
        name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        label: 'Mixtral 8x7B Instruct',
        provider: 'Together',
        maxTokenAllowed: 8192,
      },
    ],
    getApiKeyLink: 'https://api.together.xyz/settings/api-keys',
  },
  {
    name: 'Perplexity',
    staticModels: [
      {
        name: 'llama-3.1-sonar-small-128k-online',
        label: 'Sonar Small Online',
        provider: 'Perplexity',
        maxTokenAllowed: 8192,
      },
      {
        name: 'llama-3.1-sonar-large-128k-online',
        label: 'Sonar Large Online',
        provider: 'Perplexity',
        maxTokenAllowed: 8192,
      },
      {
        name: 'llama-3.1-sonar-huge-128k-online',
        label: 'Sonar Huge Online',
        provider: 'Perplexity',
        maxTokenAllowed: 8192,
      },
    ],
    getApiKeyLink: 'https://www.perplexity.ai/settings/api',
  },
];

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {
  Anthropic: {
    apiTokenKey: 'ANTHROPIC_API_KEY',
  },
  OpenAI: {
    apiTokenKey: 'OPENAI_API_KEY',
  },
  Groq: {
    apiTokenKey: 'GROQ_API_KEY',
  },
  HuggingFace: {
    apiTokenKey: 'HuggingFace_API_KEY',
  },
  OpenRouter: {
    apiTokenKey: 'OPEN_ROUTER_API_KEY',
  },
  Google: {
    apiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  OpenAILike: {
    baseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
    apiTokenKey: 'OPENAI_LIKE_API_KEY',
  },
  Together: {
    baseUrlKey: 'TOGETHER_API_BASE_URL',
    apiTokenKey: 'TOGETHER_API_KEY',
  },
  Deepseek: {
    apiTokenKey: 'DEEPSEEK_API_KEY',
  },
  Mistral: {
    apiTokenKey: 'MISTRAL_API_KEY',
  },
  LMStudio: {
    baseUrlKey: 'LMSTUDIO_API_BASE_URL',
  },
  xAI: {
    apiTokenKey: 'XAI_API_KEY',
  },
  Cohere: {
    apiTokenKey: 'COHERE_API_KEY',
  },
  Perplexity: {
    apiTokenKey: 'PERPLEXITY_API_KEY',
  },
  Ollama: {
    baseUrlKey: 'OLLAMA_API_BASE_URL',
  },
};

export const getProviderBaseUrlAndKey = (options: {
  provider: string;
  apiKeys?: Record<string, string>;
  providerSettings?: IProviderSetting;
  serverEnv?: Record<string, string>;
  defaultBaseUrlKey: string;
  defaultApiTokenKey: string;
}) => {
  const { provider, apiKeys, providerSettings, serverEnv, defaultBaseUrlKey, defaultApiTokenKey } = options;
  let settingsBaseUrl = providerSettings?.baseUrl;

  if (settingsBaseUrl && settingsBaseUrl.length == 0) {
    settingsBaseUrl = undefined;
  }

  const baseUrlKey = providerBaseUrlEnvKeys[provider]?.baseUrlKey || defaultBaseUrlKey;
  const baseUrl = settingsBaseUrl || serverEnv?.[baseUrlKey] || process.env[baseUrlKey] || import.meta.env[baseUrlKey];

  const apiTokenKey = providerBaseUrlEnvKeys[provider]?.apiTokenKey || defaultApiTokenKey;
  const apiKey =
    apiKeys?.[provider] || serverEnv?.[apiTokenKey] || process.env[apiTokenKey] || import.meta.env[apiTokenKey];

  return {
    baseUrl,
    apiKey,
  };
};
export const DEFAULT_PROVIDER = PROVIDER_LIST[0];

const staticModels: ModelInfo[] = PROVIDER_LIST.map((p) => p.staticModels).flat();

export let MODEL_LIST: ModelInfo[] = [...staticModels];

export async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const { apiKeys, providerSettings, serverEnv } = options;

  MODEL_LIST = [
    ...(
      await Promise.all(
        PROVIDER_LIST.filter(
          (p): p is ProviderInfo & { getDynamicModels: () => Promise<ModelInfo[]> } => !!p.getDynamicModels,
        ).map((p) => p.getDynamicModels(p.name, apiKeys, providerSettings?.[p.name], serverEnv)),
      )
    ).flat(),
    ...staticModels,
  ];

  return MODEL_LIST;
}

async function getTogetherModels(
  name: string,
  apiKeys?: Record<string, string>,
  settings?: IProviderSetting,
  serverEnv: Record<string, string> = {},
): Promise<ModelInfo[]> {
  try {
    const { baseUrl, apiKey } = getProviderBaseUrlAndKey({
      provider: name,
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'TOGETHER_API_BASE_URL',
      defaultApiTokenKey: 'TOGETHER_API_KEY',
    });

    if (!baseUrl) {
      return [];
    }

    if (!apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const res = (await response.json()) as any;
    const data: any[] = (res || []).filter((model: any) => model.type == 'chat');

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.display_name} - in:$${m.pricing.input.toFixed(
        2,
      )} out:$${m.pricing.output.toFixed(2)} - context ${Math.floor(m.context_length / 1000)}k`,
      provider: name,
      maxTokenAllowed: 8000,
    }));
  } catch (e) {
    console.error('Error getting OpenAILike models:', e);
    return [];
  }
}

const getOllamaBaseUrl = (name: string, settings?: IProviderSetting, serverEnv: Record<string, string> = {}) => {
  const { baseUrl } = getProviderBaseUrlAndKey({
    provider: name,
    providerSettings: settings,
    serverEnv,
    defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
    defaultApiTokenKey: '',
  });

  // Check if we're in the browser
  if (typeof window !== 'undefined') {
    // Frontend always uses localhost
    return baseUrl;
  }

  // Backend: Check if we're running in Docker
  const isDocker = process.env.RUNNING_IN_DOCKER === 'true';

  return isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
};

async function getOllamaModels(
  name: string,
  _apiKeys?: Record<string, string>,
  settings?: IProviderSetting,
  serverEnv: Record<string, string> = {},
): Promise<ModelInfo[]> {
  try {
    const baseUrl = getOllamaBaseUrl(name, settings, serverEnv);

    if (!baseUrl) {
      return [];
    }

    const response = await fetch(`${baseUrl}/api/tags`);
    const data = (await response.json()) as OllamaApiResponse;

    return data.models.map((model: OllamaModel) => ({
      name: model.name,
      label: `${model.name} (${model.details.parameter_size})`,
      provider: 'Ollama',
      maxTokenAllowed: 8000,
    }));
  } catch (e: any) {
    logStore.logError('Failed to get Ollama models', e, { baseUrl: settings?.baseUrl });
    logger.warn('Failed to get Ollama models: ', e.message || '');

    return [];
  }
}

async function getOpenAILikeModels(
  name: string,
  apiKeys?: Record<string, string>,
  settings?: IProviderSetting,
  serverEnv: Record<string, string> = {},
): Promise<ModelInfo[]> {
  try {
    const { baseUrl, apiKey } = getProviderBaseUrlAndKey({
      provider: name,
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'OPENAI_LIKE_API_BASE_URL',
      defaultApiTokenKey: 'OPENAI_LIKE_API_KEY',
    });

    if (!baseUrl) {
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
      provider: name,
    }));
  } catch (e) {
    console.error('Error getting OpenAILike models:', e);
    return [];
  }
}

type OpenRouterModelsResponse = {
  data: {
    name: string;
    id: string;
    context_length: number;
    pricing: {
      prompt: number;
      completion: number;
    };
  }[];
};

async function getOpenRouterModels(): Promise<ModelInfo[]> {
  const data: OpenRouterModelsResponse = await (
    await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  ).json();

  return data.data
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => ({
      name: m.id,
      label: `${m.name} - in:$${(m.pricing.prompt * 1_000_000).toFixed(
        2,
      )} out:$${(m.pricing.completion * 1_000_000).toFixed(2)} - context ${Math.floor(m.context_length / 1000)}k`,
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    }));
}

async function getLMStudioModels(
  name: string,
  apiKeys?: Record<string, string>,
  settings?: IProviderSetting,
  serverEnv: Record<string, string> = {},
): Promise<ModelInfo[]> {
  try {
    const { baseUrl } = getProviderBaseUrlAndKey({
      provider: name,
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      return [];
    }

    const response = await fetch(`${baseUrl}/v1/models`);
    const data = (await response.json()) as any;

    return data.data.map((model: any) => ({
      name: model.id,
      label: model.id,
      provider: 'LMStudio',
    }));
  } catch (e: any) {
    logStore.logError('Failed to get LMStudio models', e, { baseUrl: settings?.baseUrl });
    return [];
  }
}

async function initializeModelList(options: {
  env?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  apiKeys?: Record<string, string>;
}): Promise<ModelInfo[]> {
  const { providerSettings, apiKeys: providedApiKeys, env } = options;
  let apiKeys: Record<string, string> = providedApiKeys || {};

  if (!providedApiKeys) {
    try {
      const storedApiKeys = Cookies.get('apiKeys');

      if (storedApiKeys) {
        const parsedKeys = JSON.parse(storedApiKeys);

        if (typeof parsedKeys === 'object' && parsedKeys !== null) {
          apiKeys = parsedKeys;
        }
      }
    } catch (error: any) {
      logStore.logError('Failed to fetch API keys from cookies', error);
      logger.warn(`Failed to fetch apikeys from cookies: ${error?.message}`);
    }
  }

  MODEL_LIST = [
    ...(
      await Promise.all(
        PROVIDER_LIST.filter(
          (p): p is ProviderInfo & { getDynamicModels: () => Promise<ModelInfo[]> } => !!p.getDynamicModels,
        ).map((p) => p.getDynamicModels(p.name, apiKeys, providerSettings?.[p.name], env)),
      )
    ).flat(),
    ...staticModels,
  ];

  return MODEL_LIST;
}

// initializeModelList({})
export {
  getOllamaModels,
  getOpenAILikeModels,
  getLMStudioModels,
  initializeModelList,
  getOpenRouterModels,
  PROVIDER_LIST,
};
