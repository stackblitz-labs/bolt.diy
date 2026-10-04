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
