import { afterEach, describe, expect, it, vi } from 'vitest';
import LLMTRProvider from './llmtr';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('LLMTR provider', () => {
  it('uses the LLMTR gateway and key page', () => {
    const provider = new LLMTRProvider();
    expect(provider.name).toBe('LLMTR');
    expect(provider.config.apiTokenKey).toBe('LLMTR_API_KEY');
    expect(provider.getApiKeyLink).toBe('https://llmtr.com/dashboard/keys');
    expect(provider.staticModels.length).toBeGreaterThan(0);
  });

  it('returns no dynamic models when the API key is missing', async () => {
    vi.stubEnv('LLMTR_API_KEY', '');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const models = await new LLMTRProvider().getDynamicModels({}, undefined, {});
    expect(models).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists text models from the OpenAI-compatible catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { id: 'minimax/minimax-m3.1-flash', context_length: 204800 },
            {
              id: 'audio-only',
              context_window: 32000,
              architecture: { output_modalities: ['audio'] },
            },
            {
              id: 'llmtr/qwen3-8-27b',
              context_length: 131072,
              architecture: { output_modalities: ['text'] },
            },
          ],
        }),
      ),
    );

    const models = await new LLMTRProvider().getDynamicModels({}, undefined, { LLMTR_API_KEY: 'k' });
    expect(models.map((model) => model.name)).toEqual(['minimax/minimax-m3.1-flash', 'llmtr/qwen3-8-27b']);
    expect(models[0]?.label).toContain('context 204k');
    expect(models[0]?.maxTokenAllowed).toBe(204800);
    expect(models.every((model) => model.provider === 'LLMTR')).toBe(true);
  });

  it('returns an empty list when the catalog request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));

    const models = await new LLMTRProvider().getDynamicModels({}, undefined, { LLMTR_API_KEY: 'k' });
    expect(models).toEqual([]);
  });
});
