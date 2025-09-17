import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderCategory } from './provider-categories';
import { getCategoryConfig } from './provider-categories';

/**
 * Token optimization utilities for provider-specific prompts
 */

export interface TokenOptimizationConfig {
  maxContextTokens: number;
  reservedTokensForResponse: number;
  reservedTokensForContext: number;
  availableForPrompt: number;
  shouldOptimize: boolean;
  optimizationLevel: 'none' | 'minimal' | 'moderate' | 'aggressive' | 'ultra';
}

/**
 * Calculates token optimization configuration based on model capabilities
 */
export function getTokenOptimizationConfig(
  modelDetails: ModelInfo,
  category: ProviderCategory,
): TokenOptimizationConfig {
  const contextWindow = modelDetails.maxTokenAllowed || 32000;
  const completionTokens = modelDetails.maxCompletionTokens || 4096;
  const categoryConfig = getCategoryConfig(category);

  // Reserve tokens for response and context
  const reservedTokensForResponse = Math.min(completionTokens, 8192); // Cap at 8K for prompt optimization
  const reservedTokensForContext = Math.max(contextWindow * 0.1, 2000); // Reserve 10% or 2K minimum for context
  const availableForPrompt = Math.max(
    contextWindow - reservedTokensForResponse - reservedTokensForContext,
    1000, // Minimum 1K tokens for prompt
  );

  // Determine optimization level based on available tokens and category
  let optimizationLevel: TokenOptimizationConfig['optimizationLevel'] = 'none';
  let shouldOptimize = false;

  if (availableForPrompt < 4000) {
    optimizationLevel = 'ultra';
    shouldOptimize = true;
  } else if (availableForPrompt < 8000) {
    optimizationLevel = 'aggressive';
    shouldOptimize = true;
  } else if (availableForPrompt < 16000) {
    optimizationLevel = 'moderate';
    shouldOptimize = true;
  } else if (availableForPrompt < 32000) {
    optimizationLevel = 'minimal';
    shouldOptimize = categoryConfig.promptOptimizations.tokenReduction > 0;
  }

  // Speed-optimized providers should always optimize
  if (category === 'speed-optimized') {
    shouldOptimize = true;
    optimizationLevel = optimizationLevel === 'none' ? 'moderate' : optimizationLevel;
  }

  // High-context providers can use more tokens
  if (category === 'high-context' && availableForPrompt > 50000) {
    shouldOptimize = false;
    optimizationLevel = 'none';
  }

  return {
    maxContextTokens: contextWindow,
    reservedTokensForResponse,
    reservedTokensForContext,
    availableForPrompt,
    shouldOptimize,
    optimizationLevel,
  };
}

/**
 * Content length targets based on optimization level
 */
export const OPTIMIZATION_TARGETS = {
  none: { maxChars: 50000, maxSections: 12 },
  minimal: { maxChars: 40000, maxSections: 10 },
  moderate: { maxChars: 25000, maxSections: 8 },
  aggressive: { maxChars: 15000, maxSections: 6 },
  ultra: { maxChars: 8000, maxSections: 4 },
} as const;

/**
 * Estimates token count from text (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncates text to fit within token limit while preserving meaning
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokenCount(text);

  if (estimatedTokens <= maxTokens) {
    return text;
  }

  const maxChars = maxTokens * 4;
  const truncated = text.substring(0, maxChars - 100); // Leave buffer for sentence completion

  // Try to end at a sentence or paragraph boundary
  const lastSentence = truncated.lastIndexOf('.');
  const lastParagraph = truncated.lastIndexOf('\n\n');
  const lastNewline = truncated.lastIndexOf('\n');

  if (lastParagraph > maxChars * 0.8) {
    return truncated.substring(0, lastParagraph);
  } else if (lastSentence > maxChars * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  } else if (lastNewline > maxChars * 0.6) {
    return truncated.substring(0, lastNewline);
  }

  return truncated + '...';
}

/**
 * Optimizes content based on optimization level
 */
export function optimizeContentForTokens(
  content: string,
  optimizationLevel: TokenOptimizationConfig['optimizationLevel'],
): string {
  if (optimizationLevel === 'none') {
    return content;
  }

  const target = OPTIMIZATION_TARGETS[optimizationLevel];
  let optimized = content;

  // Apply progressive optimizations based on level
  switch (optimizationLevel) {
    case 'ultra':
      // Most aggressive optimization
      optimized = optimized
        .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
        .replace(/\s{2,}/g, ' ') // Reduce multiple spaces
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic formatting
        .replace(/`([^`]+)`/g, '$1') // Remove code formatting
        .replace(/\s+- /g, ' • ') // Shorten bullet points
        .replace(/CRITICAL:\s*/g, '') // Remove emphasis words
        .replace(/IMPORTANT:\s*/g, '')
        .replace(/MANDATORY:\s*/g, '');
      break;

    case 'aggressive':
      // Significant optimization
      optimized = optimized
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .replace(/CRITICAL:\s*/g, '')
        .replace(/IMPORTANT:\s*/g, '');
      break;

    case 'moderate':
      // Moderate optimization
      optimized = optimized.replace(/\n{4,}/g, '\n\n\n').replace(/\s{3,}/g, '  ');
      break;

    case 'minimal':
      // Light optimization
      optimized = optimized.replace(/\n{5,}/g, '\n\n\n\n');
      break;
  }

  // Final truncation if still too long
  if (optimized.length > target.maxChars) {
    optimized = truncateToTokenLimit(optimized, target.maxChars / 4);
  }

  return optimized;
}

/**
 * Prioritizes sections based on category and optimization level
 */
export function prioritizeSections(
  sections: Array<{ name: string; content: string; priority: number }>,
  optimizationLevel: TokenOptimizationConfig['optimizationLevel'],
  category: ProviderCategory,
): Array<{ name: string; content: string; priority: number }> {
  const target = OPTIMIZATION_TARGETS[optimizationLevel];
  const categoryConfig = getCategoryConfig(category);

  // Sort by priority
  const sorted = sections.sort((a, b) => a.priority - b.priority);

  // For ultra optimization, only keep the most critical sections
  if (optimizationLevel === 'ultra') {
    const criticalSections = categoryConfig.promptOptimizations.prioritizeSections.slice(0, 3);
    return sorted.filter((section) => criticalSections.includes(section.name));
  }

  // For aggressive optimization, limit to target number of sections
  if (optimizationLevel === 'aggressive') {
    return sorted.slice(0, target.maxSections);
  }

  // For moderate optimization, include most sections but may truncate content
  if (optimizationLevel === 'moderate') {
    return sorted.slice(0, Math.min(sections.length, target.maxSections + 2));
  }

  return sorted;
}

/**
 * Calculates optimal prompt size for a model and category
 */
export function calculateOptimalPromptSize(
  modelDetails: ModelInfo,
  category: ProviderCategory,
  hasContext: boolean = false,
): {
  targetTokens: number;
  maxTokens: number;
  optimizationLevel: TokenOptimizationConfig['optimizationLevel'];
} {
  const config = getTokenOptimizationConfig(modelDetails, category);
  const categoryConfig = getCategoryConfig(category);

  let targetTokens = config.availableForPrompt;

  // Adjust for context
  if (hasContext) {
    targetTokens = Math.max(targetTokens * 0.6, 2000); // Reserve more space for context
  }

  // Apply category-specific token reduction
  const reductionPercent = categoryConfig.promptOptimizations.tokenReduction;

  if (reductionPercent > 0) {
    targetTokens = Math.max(targetTokens * (1 - reductionPercent / 100), 1000);
  } else if (reductionPercent < 0) {
    // Negative reduction means expansion for high-context models
    targetTokens = Math.min(targetTokens * (1 + Math.abs(reductionPercent) / 100), config.availableForPrompt);
  }

  return {
    targetTokens: Math.floor(targetTokens),
    maxTokens: config.availableForPrompt,
    optimizationLevel: config.optimizationLevel,
  };
}
