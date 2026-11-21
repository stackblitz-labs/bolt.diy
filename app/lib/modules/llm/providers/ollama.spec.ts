import { generateText } from 'ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OllamaProvider from './ollama';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Ollama provider', () => {
  it.each([
    { setting: undefined, expected: 65_536 },
    { setting: '24576', expected: 24_576 },
  ])('sends num_ctx=$expected and preserves other runtime options', async ({ setting, expected }) => {
    vi.stubEnv('DEFAULT_NUM_CTX', setting);

    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        model: 'example',
        created_at: '2026-11-21T00:00:00Z',
        done: true,
        done_reason: 'stop',
        message: { role: 'assistant', content: 'Hello' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await generateText({
      model: new OllamaProvider().getModelInstance({ model: 'example' }),
      prompt: 'Say hello.',
      providerOptions: { ollama: { options: { temperature: 0 } } },
    });

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(JSON.parse(request.body).options).toEqual({ num_ctx: expected, temperature: 0 });
  });

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
