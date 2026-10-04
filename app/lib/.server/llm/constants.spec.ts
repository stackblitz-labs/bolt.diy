import { describe, expect, it } from 'vitest';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, PROVIDER_COMPLETION_LIMITS, isReasoningModel } from './constants';

describe('LLM constants', () => {
  it('keeps the OpenRouter completion limit within the affordable token budget', () => {
    /*
     * The OpenRouter key used by the e2e suite has a limited balance and rejects
     * requests whose `max_tokens` exceed what it can afford (~3284 at the time
     * of writing). Raising this reintroduces HTTP 402 failures that surface as
     * "Server Error" mid-stream, so it is pinned deliberately.
     */
    expect(PROVIDER_COMPLETION_LIMITS.OpenRouter).toBe(3072);
  });

  it('defines a completion limit for every registered cloud provider', () => {
    for (const provider of ['OpenAI', 'Anthropic', 'Google', 'OpenRouter', 'Groq', 'xAI']) {
      expect(PROVIDER_COMPLETION_LIMITS[provider]).toBeGreaterThan(0);
    }
  });

  it('exposes a global fallback token cap', () => {
    expect(MAX_TOKENS).toBeGreaterThan(0);
  });

  it('allows a limited number of continuation segments', () => {
    expect(MAX_RESPONSE_SEGMENTS).toBe(2);
  });

  describe('isReasoningModel', () => {
    it.each([
      ['o1', true],
      ['o1-mini', true],
      ['o1-preview', true],
      ['o3', true],
      ['o3-mini', true],
      ['gpt-5', true],
      ['gpt-5-mini', true],
      ['GPT-5', true],
      ['claude-3-5-sonnet-latest', false],
      ['gpt-4o', false],
      ['gpt-4', false],
      ['gemini-2.0-flash', false],
      ['', false],
    ])('classifies %s as reasoning=%s', (model, expected) => {
      expect(isReasoningModel(model)).toBe(expected);
    });

    it('only matches bare model ids because the pattern is anchored', () => {
      /*
       * OpenRouter model ids are namespaced (`openai/o3`), so they are NOT
       * detected as reasoning models. Pinned because the AI SDK migration
       * changes how reasoning models are identified; if this flips, reasoning
       * models start receiving sampling parameters they do not accept.
       */
      expect(isReasoningModel('openai/o3')).toBe(false);
      expect(isReasoningModel('openai/gpt-5')).toBe(false);
      expect(isReasoningModel('stealth/space-bunny-alpha')).toBe(false);
    });
  });
});
