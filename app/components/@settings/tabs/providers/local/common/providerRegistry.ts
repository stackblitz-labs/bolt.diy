import { BsRobot } from 'react-icons/bs';
import { FaFlask } from 'react-icons/fa';
import { SiOpenai } from 'react-icons/si';
import type { IconType } from 'react-icons';
import type {
  ProviderKey,
  ProviderRegistryEntry,
  Provider,
} from '~/components/@settings/tabs/providers/local/common/types';
import { PROVIDER_DESCRIPTIONS, PROVIDER_DEFAULT_URLS } from '~/components/@settings/tabs/providers/local/common/types';
import OllamaProvider from '~/components/@settings/tabs/providers/local/ollama/OllamaProvider';
import LMStudioProvider from '~/components/@settings/tabs/providers/local/lmstudio/LMStudioProvider';
import OpenAILikeProvider from '~/components/@settings/tabs/providers/local/openailike/OpenAILikeProvider';
import { createOllamaApiClient } from '~/components/@settings/tabs/providers/local/ollama/api';
import { createLMStudioApiClient } from '~/components/@settings/tabs/providers/local/lmstudio/api';
import { createOpenAILikeApiClient } from '~/components/@settings/tabs/providers/local/openailike/api';

// Provider icons mapping
export const PROVIDER_ICONS: Record<ProviderKey, IconType> = {
  Ollama: FaFlask,
  LMStudio: BsRobot,
  OpenAILike: SiOpenai,
};

// Provider colors for UI consistency
export const PROVIDER_COLORS = {
  Ollama: {
    primary: 'purple',
    bg: 'bg-purple-500',
    bgLight: 'bg-purple-500/10',
    text: 'text-purple-500',
    hover: 'hover:bg-purple-600',
    ring: 'focus:ring-purple-500/30',
  },
  LMStudio: {
    primary: 'blue',
    bg: 'bg-blue-500',
    bgLight: 'bg-blue-500/10',
    text: 'text-blue-500',
    hover: 'hover:bg-blue-600',
    ring: 'focus:ring-blue-500/30',
  },
  OpenAILike: {
    primary: 'green',
    bg: 'bg-green-500',
    bgLight: 'bg-green-500/10',
    text: 'text-green-500',
    hover: 'hover:bg-green-600',
    ring: 'focus:ring-green-500/30',
  },
};

/**
 * Provider registry with metadata for all local providers
 */
export const PROVIDER_REGISTRY: Record<ProviderKey, ProviderRegistryEntry> = {
  Ollama: {
    key: 'Ollama',
    name: 'Ollama',
    icon: PROVIDER_ICONS.Ollama,
    description: PROVIDER_DESCRIPTIONS.Ollama,
    defaultSettings: {
      enabled: false,
      baseUrl: PROVIDER_DEFAULT_URLS.Ollama,
      apiKey: '',
    },
    component: () => Promise.resolve(OllamaProvider),
    apiClient: () => Promise.resolve(createOllamaApiClient(PROVIDER_DEFAULT_URLS.Ollama)),
  },
  LMStudio: {
    key: 'LMStudio',
    name: 'LM Studio',
    icon: PROVIDER_ICONS.LMStudio,
    description: PROVIDER_DESCRIPTIONS.LMStudio,
    defaultSettings: {
      enabled: false,
      baseUrl: PROVIDER_DEFAULT_URLS.LMStudio,
      apiKey: '',
    },
    component: () => Promise.resolve(LMStudioProvider),
    apiClient: () => Promise.resolve(createLMStudioApiClient(PROVIDER_DEFAULT_URLS.LMStudio)),
  },
  OpenAILike: {
    key: 'OpenAILike',
    name: 'OpenAI-Like',
    icon: PROVIDER_ICONS.OpenAILike,
    description: PROVIDER_DESCRIPTIONS.OpenAILike,
    defaultSettings: {
      enabled: false,
      baseUrl: PROVIDER_DEFAULT_URLS.OpenAILike,
      apiKey: '',
    },
    component: () => Promise.resolve(OpenAILikeProvider),
    apiClient: () => Promise.resolve(createOpenAILikeApiClient(PROVIDER_DEFAULT_URLS.OpenAILike)),
  },
};

/**
 * Get a provider from the registry by key
 */
export function getProvider(key: ProviderKey): ProviderRegistryEntry {
  return PROVIDER_REGISTRY[key];
}

/**
 * Get all providers from the registry
 */
export function getAllProviders(): ProviderRegistryEntry[] {
  return Object.values(PROVIDER_REGISTRY);
}

// Provider configuration metadata
export const PROVIDER_CONFIG = {
  Ollama: {
    name: 'Ollama',
    description: PROVIDER_DESCRIPTIONS.Ollama,
    icon: PROVIDER_ICONS.Ollama,
    colors: PROVIDER_COLORS.Ollama,
    defaultUrl: PROVIDER_DEFAULT_URLS.Ollama,
    isLocal: true,
  },
  LMStudio: {
    name: 'LM Studio',
    description: PROVIDER_DESCRIPTIONS.LMStudio,
    icon: PROVIDER_ICONS.LMStudio,
    colors: PROVIDER_COLORS.LMStudio,
    defaultUrl: PROVIDER_DEFAULT_URLS.LMStudio,
    isLocal: true,
  },
  OpenAILike: {
    name: 'OpenAI-Like',
    description: PROVIDER_DESCRIPTIONS.OpenAILike,
    icon: PROVIDER_ICONS.OpenAILike,
    colors: PROVIDER_COLORS.OpenAILike,
    defaultUrl: PROVIDER_DEFAULT_URLS.OpenAILike,
    isLocal: false,
  },
} as const;

/**
 * Get provider configuration by name
 */
export function getProviderConfig(providerName: ProviderKey) {
  return PROVIDER_CONFIG[providerName];
}

/**
 * Get all provider names
 */
export function getAllProviderNames(): ProviderKey[] {
  return Object.keys(PROVIDER_CONFIG) as ProviderKey[];
}

/**
 * Get local provider names
 */
export function getLocalProviderNames(): ProviderKey[] {
  return getAllProviderNames().filter((name) => PROVIDER_CONFIG[name].isLocal);
}

/**
 * Check if provider is local
 */
export function isLocalProvider(provider: Provider): boolean {
  return PROVIDER_CONFIG[provider.key].isLocal;
}
