import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebSearchEnv } from './env';

describe('getWebSearchEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers Cloudflare bindings over process.env', () => {
    vi.stubEnv('TAVILY_API_KEY', 'from-process');

    expect(getWebSearchEnv({ TAVILY_API_KEY: 'from-cloudflare' }).TAVILY_API_KEY).toBe('from-cloudflare');
  });

  it('falls back to process.env and treats blank values as unset', () => {
    vi.stubEnv('TAVILY_API_KEY', 'from-process');
    vi.stubEnv('BRAVE_SEARCH_API_KEY', '   ');

    expect(getWebSearchEnv({ TAVILY_API_KEY: '' })).toEqual({
      WEB_SEARCH_PROVIDER: undefined,
      TAVILY_API_KEY: 'from-process',
      BRAVE_SEARCH_API_KEY: undefined,
    });
  });

  it('handles a missing Cloudflare env', () => {
    vi.stubEnv('WEB_SEARCH_PROVIDER', ' brave ');

    expect(getWebSearchEnv(undefined).WEB_SEARCH_PROVIDER).toBe('brave');
  });
});
