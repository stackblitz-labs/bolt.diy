/**
 * Shared model utility functions that can be used on both client and server
 */

/**
 * Reasoning models that require maxCompletionTokens instead of maxTokens
 * These models use internal reasoning tokens and have different API parameter requirements
 */
export function isReasoningModel(modelName: string): boolean {
  // Claude Sonnet 4 and other reasoning models require maxCompletionTokens
  return /^(o1|o3|gpt-5|claude-.*-4|claude-4|grok.*reasoning|deepseek.*reasoner)/i.test(modelName);
}
