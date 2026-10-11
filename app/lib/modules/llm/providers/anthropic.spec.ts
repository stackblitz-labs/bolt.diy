import { describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(vi.fn().mockReturnValue({ id: 'mock-model' })),
}));

vi.mock('~/lib/modules/llm/manager', () => ({
  LLMManager: {
    getInstance: vi.fn().mockReturnValue({ env: {} }),
  },
}));

import AnthropicProvider from './anthropic';
import { createAnthropic } from '@ai-sdk/anthropic';

describe('AnthropicProvider', () => {
  it('passes User-Agent header when creating Anthropic client', () => {
    const provider = new AnthropicProvider();
    provider.getModelInstance({
      model: 'claude-3-5-sonnet-20241022',
      serverEnv: {} as any,
      apiKeys: { ANTHROPIC_API_KEY: 'test-key' },
      providerSettings: {},
    });

    expect(createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.stringMatching(/^bolt\.diy\//),
        }),
      }),
    );
  });
});
