import { type Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('token-counter');

/**
 * Simplified token counting utility.
 *
 * This is a rough approximation as different tokenizers work differently.
 * For production scenarios, you might want to use model-specific tokenizers like tiktoken.
 */

// Rough approximation: 1 token ≈ 4 characters for English text
const CHARS_PER_TOKEN = 4;

// Different content types have different token densities
const TOKEN_MULTIPLIERS = {
  TEXT: 1,
  CODE: 1.1, // Code is slightly more token-dense than plain text
  JSON: 1.2, // JSON has many special characters
  SYSTEM_PROMPT: 1, // System prompts are usually plain text
};

/**
 * Rough estimation of tokens from text content
 */
export function estimateTokens(text: string, contentType: keyof typeof TOKEN_MULTIPLIERS = 'TEXT'): number {
  if (!text) {
    return 0;
  }

  const multiplier = TOKEN_MULTIPLIERS[contentType];
  const tokens = Math.ceil((text.length / CHARS_PER_TOKEN) * multiplier);

  return tokens;
}

/**
 * Estimates tokens for message content
 */
export function estimateMessageTokens(message: Message): number {
  // For array content (e.g., multimodal)
  if (Array.isArray(message.content)) {
    return message.content.reduce((acc, item) => {
      if (typeof item === 'string') {
        return acc + estimateTokens(item);
      } else if (item.type === 'text') {
        return acc + estimateTokens(item.text);
      } else if (item.type === 'image') {
        /*
         * Image tokens are harder to estimate, using a reasonable default
         * Most models count images as approximately 85-150 tokens
         */
        return acc + 150;
      }

      return acc;
    }, 0);
  }

  // For string content
  return estimateTokens(message.content.toString());
}

/**
 * Estimates tokens for an array of messages
 */
export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((acc, message) => {
    return acc + estimateMessageTokens(message);
  }, 0);
}

/**
 * Estimates tokens for a file's content
 */
export function estimateFileTokens(content: string, isCode: boolean = true): number {
  return estimateTokens(content, isCode ? 'CODE' : 'TEXT');
}

/**
 * Calculates token budget allocation based on model's max context window
 */
export function calculateTokenBudget(maxContextTokens: number) {
  // Reserve a portion for model completion
  const reservedCompletionTokens = 8000;

  // Allocate the remaining tokens
  const availableTokens = Math.max(0, maxContextTokens - reservedCompletionTokens);

  // Distributed budget
  return {
    // Default token allocation
    total: maxContextTokens,
    completion: reservedCompletionTokens,
    available: availableTokens,

    // Suggested allocation for different components
    systemPrompt: Math.floor(availableTokens * 0.15),
    chatHistory: Math.floor(availableTokens * 0.25),
    codeContext: Math.floor(availableTokens * 0.6),

    // Reserve some buffer for unexpected overages
    buffer: Math.floor(availableTokens * 0.05),
  };
}

/**
 * Logs the token usage details
 */
export function logTokenUsage(budget: ReturnType<typeof calculateTokenBudget>, usage: Record<string, number>) {
  logger.debug('Token Budget:', budget);
  logger.debug('Token Usage:', usage);

  // Calculate remaining tokens
  const usedTokens = Object.values(usage).reduce((a, b) => a + b, 0);
  const remainingTokens = budget.total - usedTokens;

  logger.debug(`Total tokens used: ${usedTokens}/${budget.total} (${remainingTokens} remaining)`);

  return {
    used: usedTokens,
    remaining: remainingTokens,
    details: usage,
  };
}
