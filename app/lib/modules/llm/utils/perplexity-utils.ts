import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PerplexityUtils');

export interface PerplexityModel {
  id: string;
  name: string;
  description?: string;
  maxTokens: number;
  isDeprecated?: boolean;
  replacement?: string;
  capabilities?: string[];
}

/**
 * 2025 Perplexity Sonar Model Definitions
 * Based on the latest Perplexity API documentation
 */
export const PERPLEXITY_MODELS: Record<string, PerplexityModel> = {
  // Core Sonar Models
  sonar: {
    id: 'sonar',
    name: 'Sonar',
    description: 'Built on Llama 3.3 70B, optimized for fast AI search with real-time web access',
    maxTokens: 127072,
    capabilities: ['web-search', 'real-time', 'fast-inference'],
  },
  'sonar-pro': {
    id: 'sonar-pro',
    name: 'Sonar Pro',
    description: 'Advanced search capabilities with extended citations and multi-step query handling',
    maxTokens: 127072,
    capabilities: ['web-search', 'extended-citations', 'multi-step-queries'],
  },

  // Reasoning Models
  'sonar-reasoning': {
    id: 'sonar-reasoning',
    name: 'Sonar Reasoning',
    description: 'Enhanced planning and reasoning with logical chain of thought for factual information',
    maxTokens: 127072,
    capabilities: ['web-search', 'chain-of-thought', 'logical-reasoning'],
  },
  'sonar-reasoning-pro': {
    id: 'sonar-reasoning-pro',
    name: 'Sonar Reasoning Pro',
    description: 'Advanced reasoning with detailed citations and multi-source data synthesis',
    maxTokens: 127072,
    capabilities: ['web-search', 'advanced-reasoning', 'multi-source-synthesis', 'detailed-citations'],
  },

  // Deep Research Model
  'sonar-deep-research': {
    id: 'sonar-deep-research',
    name: 'Sonar Deep Research',
    description: 'Expert-level research conducting exhaustive searches across hundreds of sources',
    maxTokens: 127072,
    capabilities: ['deep-research', 'comprehensive-analysis', 'expert-insights', 'detailed-reports'],
  },

  // Legacy Models (maintained for backward compatibility)
  'llama-3.1-sonar-small-128k-online': {
    id: 'llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small 128K Online',
    description: 'Legacy Llama 3.1 based model',
    maxTokens: 127072,
    isDeprecated: true,
    replacement: 'sonar',
    capabilities: ['web-search', 'legacy'],
  },
  'llama-3.1-sonar-large-128k-online': {
    id: 'llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large 128K Online',
    description: 'Legacy Llama 3.1 based model',
    maxTokens: 127072,
    isDeprecated: true,
    replacement: 'sonar-pro',
    capabilities: ['web-search', 'legacy'],
  },
  'llama-3.1-sonar-huge-128k-online': {
    id: 'llama-3.1-sonar-huge-128k-online',
    name: 'Llama 3.1 Sonar Huge 128K Online',
    description: 'Legacy Llama 3.1 based model',
    maxTokens: 127072,
    isDeprecated: true,
    replacement: 'sonar-reasoning-pro',
    capabilities: ['web-search', 'legacy'],
  },
};

/**
 * Search modes for Perplexity models (High/Medium/Low)
 */
export enum PerplexitySearchMode {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface SearchModeConfig {
  mode: PerplexitySearchMode;
  description: string;
  costMultiplier: number;
  maxSources?: number;
}

export const SEARCH_MODES: Record<PerplexitySearchMode, SearchModeConfig> = {
  [PerplexitySearchMode.HIGH]: {
    mode: PerplexitySearchMode.HIGH,
    description: 'Maximum depth and context for complex queries',
    costMultiplier: 1.5,
    maxSources: 50,
  },
  [PerplexitySearchMode.MEDIUM]: {
    mode: PerplexitySearchMode.MEDIUM,
    description: 'Balanced approach for moderately complex questions',
    costMultiplier: 1.0,
    maxSources: 25,
  },
  [PerplexitySearchMode.LOW]: {
    mode: PerplexitySearchMode.LOW,
    description: 'Cost-optimized for straightforward queries',
    costMultiplier: 0.7,
    maxSources: 10,
  },
};

/**
 * Validates if a model ID is valid for Perplexity
 */
export function validatePerplexityModel(modelId: string): {
  isValid: boolean;
  model?: PerplexityModel;
  error?: string;
  warning?: string;
} {
  const model = PERPLEXITY_MODELS[modelId];

  if (!model) {
    return {
      isValid: false,
      error: `Invalid Perplexity model: "${modelId}". Available models: ${Object.keys(PERPLEXITY_MODELS).join(', ')}`,
    };
  }

  if (model.isDeprecated) {
    const warning = model.replacement
      ? `Model "${modelId}" is deprecated. Consider using "${model.replacement}" instead.`
      : `Model "${modelId}" is deprecated and may be removed in future versions.`;

    logger.warn(warning);

    return {
      isValid: true,
      model,
      warning,
    };
  }

  return {
    isValid: true,
    model,
  };
}

/**
 * Gets model suggestions based on capabilities
 */
export function getModelSuggestions(requiredCapabilities: string[]): PerplexityModel[] {
  return Object.values(PERPLEXITY_MODELS)
    .filter((model) => !model.isDeprecated)
    .filter((model) => requiredCapabilities.every((capability) => model.capabilities?.includes(capability)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Gets all available (non-deprecated) models
 */
export function getAvailableModels(): PerplexityModel[] {
  return Object.values(PERPLEXITY_MODELS)
    .filter((model) => !model.isDeprecated)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Gets all models including deprecated ones
 */
export function getAllModels(): PerplexityModel[] {
  return Object.values(PERPLEXITY_MODELS).sort((a, b) => {
    // Sort by deprecated status first (non-deprecated first), then by name
    if (a.isDeprecated !== b.isDeprecated) {
      return a.isDeprecated ? 1 : -1;
    }

    return a.name.localeCompare(b.name);
  });
}

/**
 * Formats model name with deprecation warning if applicable
 */
export function formatModelLabel(modelId: string): string {
  const model = PERPLEXITY_MODELS[modelId];

  if (!model) {
    return modelId;
  }

  const baseLabel = model.description ? `${model.name} - ${model.description}` : model.name;

  if (model.isDeprecated) {
    const replacement = model.replacement ? ` (use ${model.replacement})` : '';
    return `${baseLabel} [DEPRECATED${replacement}]`;
  }

  return baseLabel;
}
