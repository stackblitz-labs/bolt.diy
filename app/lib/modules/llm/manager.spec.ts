import { describe, expect, it } from 'vitest';
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
  it('registers providers from the registry on first getInstance', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);
    expect(names).toContain('OpenRouter');
    expect(names.length).toBeGreaterThan(0);
  });

  it('registers exactly the enabled providers', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);
    expect(names.sort()).toEqual(['Anthropic', 'Google', 'OpenAI', 'OpenRouter']);
  });

  it('does not register providers outside the enabled set', () => {
    const manager = LLMManager.getInstance({});
    const names = manager.getAllProviders().map((p) => p.name);
    expect(names).not.toContain('Groq');
    expect(names).not.toContain('Together');
    expect(names).not.toContain('Ollama');
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
