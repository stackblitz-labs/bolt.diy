import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../manager', () => ({
  LLMManager: class {
    static getInstance() {
      return { env: {} };
    }
  },
}));

import OpenAIProvider from './openai';

const provider = new OpenAIProvider();

describe('OpenAIProvider.getDynamicModels', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws error when fetch fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    vi.spyOn(provider as any, 'getProviderBaseUrlAndKey').mockReturnValue({
      apiKey: 'bad-key',
    });

    await expect(provider.getDynamicModels()).rejects.toThrow('Failed to fetch models from OpenAI: Invalid API key');
  });
});
