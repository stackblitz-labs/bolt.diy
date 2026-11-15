import { afterEach, describe, expect, it, vi } from 'vitest';
import { BaseProvider } from './base-provider';
import { LLMManager } from './manager';

class FakeProvider extends BaseProvider {
  name = 'FakeProvider';
  staticModels = [];
  config = { apiTokenKey: 'FAKE_API_KEY' };
  getModelInstance(_options: any): any {
    throw new Error('not implemented');
  }
}

describe('LLMManager', () => {
  afterEach(() => vi.restoreAllMocks());

  it('merges cached dynamic models without duplicating static entries', async () => {
    const manager = LLMManager.getInstance({});
    const provider = manager.getProvider('OpenRouter')!;
    const dynamic = { ...provider.staticModels[0], label: 'Current API label', isFree: false };
    vi.spyOn(provider, 'getModelsFromCache').mockReturnValue([dynamic]);

    const models = await manager.getModelListFromProvider(provider, {});
    expect(models.filter((model) => model.name === dynamic.name)).toEqual([dynamic]);
    expect(new Set(models.map((model) => model.name)).size).toBe(models.length);
  });

  it('loads dynamic and static models only for the requested active providers', async () => {
    const manager = LLMManager.getInstance({});
    const active = manager.getProvider('OpenRouter')!;
    const inactive = manager.getProvider('Anthropic')!;
    const activeCache = vi.spyOn(active, 'getModelsFromCache').mockReturnValue([]);
    const inactiveCache = vi.spyOn(inactive, 'getModelsFromCache');

    const models = await manager.updateModelList({ enabledProviderNames: ['OpenRouter'] });
    expect(activeCache).toHaveBeenCalledOnce();
    expect(inactiveCache).not.toHaveBeenCalled();
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.provider === 'OpenRouter')).toBe(true);

    expect(await manager.updateModelList({ enabledProviderNames: [] })).toEqual([]);
    await manager.updateModelList({ enabledProviderNames: ['OpenRouter'] });
  });

  it('registers providers from the registry on first getInstance', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);
    expect(names).toContain('OpenRouter');
    expect(names.length).toBeGreaterThan(0);
  });

  it('registers exactly the enabled providers', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);

    // All 22 providers should now be registered
    expect(names.sort()).toEqual([
      'AmazonBedrock',
      'Anthropic',
      'Cerebras',
      'Cohere',
      'Deepseek',
      'Fireworks',
      'Github',
      'Google',
      'Groq',
      'HuggingFace',
      'Hyperbolic',
      'LMStudio',
      'Mistral',
      'Moonshot',
      'Ollama',
      'OpenAI',
      'OpenAILike',
      'OpenRouter',
      'Perplexity',
      'Together',
      'Z.ai',
      'xAI',
    ]);
  });

  it('registers all 22 providers including newly restored ones', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);

    // Verify newly restored providers are registered
    expect(names).toContain('Groq');
    expect(names).toContain('Together');
    expect(names).toContain('Ollama');
    expect(names).toContain('HuggingFace');
    expect(names).toContain('Cohere');
    expect(names).toContain('Mistral');
    expect(names.length).toBe(22);
  });

  it('exposes each enabled provider via getProvider', () => {
    const manager = LLMManager.getInstance({});

    for (const name of ['OpenRouter', 'Anthropic', 'OpenAI', 'Google']) {
      expect(manager.getProvider(name)).toBeDefined();
    }
  });

  it('defaults to OpenRouter regardless of registration order', () => {
    const manager = LLMManager.getInstance({});
    expect(manager.getDefaultProvider().name).toBe('OpenRouter');
  });

  it('getProvider returns the registered provider', () => {
    const manager = LLMManager.getInstance({});
    expect(manager.getProvider('OpenRouter')).toBeDefined();
    expect(manager.getProvider('DoesNotExist')).toBeUndefined();
  });

  it('registerProvider ignores duplicate provider names', () => {
    const manager = LLMManager.getInstance({});
    const before = manager.getAllProviders().length;
    manager.registerProvider(new FakeProvider() as unknown as BaseProvider);
    manager.registerProvider(new FakeProvider() as unknown as BaseProvider);
    expect(manager.getAllProviders().length).toBe(before + 1);
  });

  it('getModelList contains static models from providers', () => {
    const manager = LLMManager.getInstance({});
    expect(manager.getModelList().length).toBeGreaterThan(0);
  });
});
