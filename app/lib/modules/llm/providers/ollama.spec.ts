import { afterEach, describe, expect, it, vi } from 'vitest';
import OllamaProvider from './ollama';

afterEach(() => vi.unstubAllGlobals());

describe('Ollama provider', () => {
  it('uses the local Ollama URL when no URL is saved in settings or the environment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        models: [
          {
            name: 'qwen3.5:9b',
            details: { parameter_size: '9B' },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await new OllamaProvider().getDynamicModels();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(models).toEqual([
      {
        name: 'qwen3.5:9b',
        label: 'qwen3.5:9b (9B)',
        provider: 'Ollama',
        maxTokenAllowed: 8000,
      },
    ]);
  });

  it('uses a saved custom URL instead of the default', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ models: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await new OllamaProvider().getDynamicModels({}, { baseUrl: 'http://ollama.local:11434' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama.local:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
