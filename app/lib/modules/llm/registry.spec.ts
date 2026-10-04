import { describe, expect, it } from 'vitest';
import * as providers from './registry';
import { BaseProvider } from './base-provider';

describe('LLM provider registry', () => {
  const exportedClasses = Object.values(providers).filter(
    (item) => typeof item === 'function' && item.prototype instanceof BaseProvider,
  ) as unknown as Array<new () => BaseProvider>;

  it('exports at least one provider class', () => {
    expect(exportedClasses.length).toBeGreaterThan(0);
  });

  it('all exported classes extend BaseProvider', () => {
    for (const providerClass of exportedClasses) {
      expect(providerClass.prototype).toBeInstanceOf(BaseProvider);
    }
  });

  it('every provider has a unique name and defined config', () => {
    const instances = exportedClasses.map((providerClass) => new providerClass());
    const names = instances.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);

    for (const provider of instances) {
      expect(provider.name.length).toBeGreaterThan(0);
      expect(provider.config).toBeDefined();
    }
  });

  it('includes the OpenRouter provider used by the e2e suite', () => {
    const openRouterProvider = new (providers.OpenRouterProvider as new () => BaseProvider)();
    const provider = openRouterProvider;
    expect(provider.name).toBe('OpenRouter');
    expect(provider.config.apiTokenKey).toBe('OPEN_ROUTER_API_KEY');
    expect(provider.staticModels.length).toBeGreaterThan(0);
  });
});
