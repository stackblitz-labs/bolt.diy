/**
 * Perplexity Model Validation and Management Utilities
 * Author: Keoma Wright
 * Purpose: Provides validation and management utilities for Perplexity AI models
 */

export interface PerplexityModelInfo {
  id: string;
  name: string;
  context: number;
  category: 'search' | 'reasoning' | 'research' | 'chat';
  deprecated?: boolean;
  replacement?: string;
}

// Comprehensive list of Perplexity models with metadata
export const PERPLEXITY_MODELS: PerplexityModelInfo[] = [
  // Current generation models (2025)
  {
    id: 'sonar',
    name: 'Sonar (Latest)',
    context: 127072,
    category: 'search',
  },
  {
    id: 'sonar-reasoning',
    name: 'Sonar Reasoning',
    context: 127072,
    category: 'reasoning',
  },
  {
    id: 'sonar-deep-research',
    name: 'Sonar Deep Research',
    context: 127072,
    category: 'research',
  },

  // Llama-based models (still supported)
  {
    id: 'llama-3.1-sonar-small-128k-online',
    name: 'Llama 3.1 Sonar Small (Online)',
    context: 127072,
    category: 'search',
  },
  {
    id: 'llama-3.1-sonar-large-128k-online',
    name: 'Llama 3.1 Sonar Large (Online)',
    context: 127072,
    category: 'search',
  },
  {
    id: 'llama-3.1-sonar-small-128k-chat',
    name: 'Llama 3.1 Sonar Small (Chat)',
    context: 127072,
    category: 'chat',
  },
  {
    id: 'llama-3.1-sonar-large-128k-chat',
    name: 'Llama 3.1 Sonar Large (Chat)',
    context: 127072,
    category: 'chat',
  },

  // Deprecated models (for backward compatibility)
  {
    id: 'sonar-pro',
    name: 'Sonar Pro (Deprecated)',
    context: 8192,
    category: 'search',
    deprecated: true,
    replacement: 'sonar',
  },
  {
    id: 'sonar-reasoning-pro',
    name: 'Sonar Reasoning Pro (Deprecated)',
    context: 8192,
    category: 'reasoning',
    deprecated: true,
    replacement: 'sonar-reasoning',
  },
];

/**
 * Validates if a model ID is supported by Perplexity
 */
export function validatePerplexityModel(modelId: string): boolean {
  return PERPLEXITY_MODELS.some((model) => model.id === modelId);
}

/**
 * Gets model information by ID
 */
export function getPerplexityModelInfo(modelId: string): PerplexityModelInfo | undefined {
  return PERPLEXITY_MODELS.find((model) => model.id === modelId);
}

/**
 * Gets non-deprecated models
 */
export function getActivePerplexityModels(): PerplexityModelInfo[] {
  return PERPLEXITY_MODELS.filter((model) => !model.deprecated);
}

/**
 * Gets model suggestions based on partial input
 */
export function getPerplexityModelSuggestions(partial: string): PerplexityModelInfo[] {
  const lowerPartial = partial.toLowerCase();
  return PERPLEXITY_MODELS.filter(
    (model) => model.id.toLowerCase().includes(lowerPartial) || model.name.toLowerCase().includes(lowerPartial),
  );
}

/**
 * Checks if a model is deprecated and returns replacement info
 */
export function checkDeprecatedModel(modelId: string): {
  deprecated: boolean;
  replacement?: string;
  message?: string;
} {
  const model = getPerplexityModelInfo(modelId);

  if (!model) {
    return { deprecated: false };
  }

  if (model.deprecated) {
    return {
      deprecated: true,
      replacement: model.replacement,
      message: `Model "${modelId}" is deprecated. Please use "${model.replacement}" instead.`,
    };
  }

  return { deprecated: false };
}

/**
 * Groups models by category
 */
export function getPerplexityModelsByCategory(): Record<string, PerplexityModelInfo[]> {
  return PERPLEXITY_MODELS.reduce(
    (acc, model) => {
      if (!acc[model.category]) {
        acc[model.category] = [];
      }

      acc[model.category].push(model);

      return acc;
    },
    {} as Record<string, PerplexityModelInfo[]>,
  );
}

/**
 * Pattern matching for flexible model validation
 */
export const PERPLEXITY_MODEL_PATTERNS = [
  /^sonar(-\w+)?$/,
  /^llama-\d+(\.\d+)?-sonar-(small|large)-\d+k-(online|chat)$/,
];

/**
 * Flexible validation that accepts patterns
 */
export function isValidPerplexityModelPattern(modelId: string): boolean {
  return PERPLEXITY_MODEL_PATTERNS.some((pattern) => pattern.test(modelId));
}
