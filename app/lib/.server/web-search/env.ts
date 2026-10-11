import type { WebSearchEnv } from './search';

type WebSearchEnvKey = 'WEB_SEARCH_PROVIDER' | 'TAVILY_API_KEY' | 'BRAVE_SEARCH_API_KEY';

/*
 * Search provider keys come from the server environment only (Cloudflare
 * bindings first, then .env.local via process.env) so they never reach the
 * browser.
 */
export function getWebSearchEnv(cloudflareEnv: Partial<Env> | undefined): WebSearchEnv {
  const processEnv = typeof process !== 'undefined' ? process.env : {};

  // Empty strings (e.g. `TAVILY_API_KEY=` copied from .env.example) count as unset
  const pick = (key: WebSearchEnvKey) => cloudflareEnv?.[key]?.trim() || processEnv[key]?.trim() || undefined;

  return {
    WEB_SEARCH_PROVIDER: pick('WEB_SEARCH_PROVIDER'),
    TAVILY_API_KEY: pick('TAVILY_API_KEY'),
    BRAVE_SEARCH_API_KEY: pick('BRAVE_SEARCH_API_KEY'),
  };
}
