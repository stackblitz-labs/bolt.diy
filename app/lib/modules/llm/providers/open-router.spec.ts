import { afterEach, describe, expect, it, vi } from 'vitest';
import OpenRouterProvider from './open-router';

afterEach(() => vi.unstubAllGlobals());

describe('OpenRouter model catalog', () => {
  it('uses exact prices for free models and excludes models without text output', async () => {
    const entry = {
      name: 'Model',
      context_length: 262144,
      architecture: { output_modalities: ['text'] },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { ...entry, id: 'free', pricing: { prompt: '0', completion: '0' } },
            { ...entry, id: 'paid', pricing: { prompt: '0.000000001', completion: '0.000000001' } },
            {
              ...entry,
              id: 'audio',
              architecture: { output_modalities: ['audio'] },
              pricing: { prompt: '0', completion: '0' },
            },
          ],
        }),
      ),
    );

    const models = await new OpenRouterProvider().getDynamicModels();
    expect(models).toHaveLength(2);
    expect(models.find((model) => model.name === 'free')?.isFree).toBe(true);
    expect(models.find((model) => model.name === 'paid')?.isFree).toBe(false);
    expect(models.find((model) => model.name === 'paid')?.label).toContain('in:$0.00');
  });
});
