import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchModelsForProviders } from '~/lib/api/modelList';

describe('fetchModelsForProviders', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('deduplicates concurrent requests for the same providers', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolve(
            new Response(JSON.stringify({ modelList: [{ name: 'test-model' }] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = fetchModelsForProviders(['OpenAI', 'Anthropic']);
    const second = fetchModelsForProviders(['Anthropic', 'OpenAI']);

    expect(second).toBe(first);
    await expect(first).resolves.toEqual([{ name: 'test-model' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws for an unsuccessful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 503,
          }),
        ),
      ),
    );

    await expect(fetchModelsForProviders(['OpenAI'])).rejects.toThrow('Failed to fetch model list (503)');
  });
});
