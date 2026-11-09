import { afterEach, describe, expect, it, vi } from 'vitest';
import RuncrateProvider from './runcrate';

afterEach(() => vi.unstubAllGlobals());

describe('Runcrate model catalog', () => {
  it('lists text models with tool support and skips static and non-chat entries', async () => {
    const entry = {
      name: 'Model',
      context_length: 262144,
      supported_features: ['tools', 'json_mode'],
      output_modalities: ['text'],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { ...entry, id: 'vendor/new-chat-model', name: 'New Chat Model' },
          { ...entry, id: 'deepseek-ai/DeepSeek-V4.1-Flash' },
          { ...entry, id: 'vendor/no-tools', supported_features: ['json_mode'] },
          { ...entry, id: 'vendor/image-model', output_modalities: ['image'] },
          { ...entry, id: 'vendor/speech-model', context_length: 0 },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const models = await new RuncrateProvider().getDynamicModels({ Runcrate: 'test-key' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.runcrate.ai/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-key' } }),
    );
    expect(models).toEqual([
      {
        name: 'vendor/new-chat-model',
        label: 'New Chat Model (Dynamic)',
        provider: 'Runcrate',
        maxTokenAllowed: 262144,
      },
    ]);
  });

  it('does not call the API without a key', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await new RuncrateProvider().getDynamicModels({}, undefined, {})).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns no dynamic models when the API answers with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('nope', { status: 401, statusText: 'Unauthorized' })),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await new RuncrateProvider().getDynamicModels({ Runcrate: 'bad-key' })).toEqual([]);
  });

  it('builds a model instance for the chosen model and requires a key', () => {
    const provider = new RuncrateProvider();

    const model = provider.getModelInstance({
      model: 'deepseek-ai/DeepSeek-V4.1-Flash',
      serverEnv: {} as Env,
      apiKeys: { Runcrate: 'test-key' },
    });

    expect(model).toMatchObject({ modelId: 'deepseek-ai/DeepSeek-V4.1-Flash' });
    expect(() => provider.getModelInstance({ model: 'x', serverEnv: {} as Env, apiKeys: {} })).toThrow(
      'Missing API key for Runcrate provider',
    );
  });
});
