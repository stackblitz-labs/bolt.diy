import type { ProviderInfo } from '~/types/model';
import type { FastModelConfig } from '~/types/generation';

export const FAST_MODEL_CONFIG: FastModelConfig = {
  OpenAI: { model: 'gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
  Anthropic: { model: 'claude-haiku-4-5-20251001', contextWindow: 200000, costPer1MTokens: 0.25 },
  Google: { model: 'gemini-1.5-flash', contextWindow: 1000000, costPer1MTokens: 0.075 },
  Groq: { model: 'llama-3.1-8b-instant', contextWindow: 128000, costPer1MTokens: 0 },
  OpenRouter: { model: 'openai/gpt-4o-mini', contextWindow: 128000, costPer1MTokens: 0.15 },
};

/**
 * Resolve a fast/cheap model for Phase 1 template selection, based on provider name.
 *
 * If the provider isn't in the mapping, we fall back to:
 * - `fallbackModel` (typically the user's configured model), or
 * - first static model advertised by the provider
 */
export function getFastModel(
  provider: ProviderInfo,
  fallbackModel?: string,
): { model: string; provider: ProviderInfo } {
  const mapped = FAST_MODEL_CONFIG[provider.name]?.model;

  if (mapped) {
    return { model: mapped, provider };
  }

  if (fallbackModel) {
    return { model: fallbackModel, provider };
  }

  const firstStaticModel = provider.staticModels?.[0]?.name;

  if (firstStaticModel) {
    return { model: firstStaticModel, provider };
  }

  /*
   * Last-resort fallback: return a well-known fast model name.
   * This may fail at runtime for some providers, but prevents returning an empty model string.
   */
  return { model: 'gpt-4o-mini', provider };
}
