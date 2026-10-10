import { decodeHtmlEntities, stripTags, truncate } from './html';
import { WebSearchError, type WebSearchProviderId, type WebSearchResponseData, type WebSearchResult } from './types';
import { isAllowedUrl } from '~/utils/url';

export const DEFAULT_MAX_RESULTS = 5;
export const MAX_RESULTS_LIMIT = 10;

const MAX_QUERY_LENGTH = 400;
const MAX_SNIPPET_LENGTH = 500;
const SEARCH_TIMEOUT_MS = 10_000;

export type WebSearchEnv = Record<string, string | undefined>;

interface SearchOptions {
  maxResults?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Picks the search backend. An explicit `WEB_SEARCH_PROVIDER` wins; otherwise
 * the first provider with an API key is used, falling back to DuckDuckGo which
 * needs no key (but is rate-limited and may block server traffic).
 */
export function resolveSearchProvider(env: WebSearchEnv): WebSearchProviderId {
  const explicit = env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();

  if (explicit === 'tavily' || explicit === 'brave' || explicit === 'duckduckgo') {
    return explicit;
  }

  if (env.TAVILY_API_KEY) {
    return 'tavily';
  }

  if (env.BRAVE_SEARCH_API_KEY) {
    return 'brave';
  }

  return 'duckduckgo';
}

function normalizeResults(results: WebSearchResult[], maxResults: number): WebSearchResult[] {
  const seen = new Set<string>();

  return results
    .filter((result) => {
      if (!result.url || !isAllowedUrl(result.url) || seen.has(result.url)) {
        return false;
      }

      seen.add(result.url);

      return true;
    })
    .slice(0, maxResults)
    .map((result) => ({
      title: result.title || result.url,
      url: result.url,
      snippet: truncate(result.snippet, MAX_SNIPPET_LENGTH),
    }));
}

async function requestJson<T>(fetchImpl: typeof fetch, url: string, init: RequestInit, provider: string): Promise<T> {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });

  if (response.status === 401 || response.status === 403) {
    throw new WebSearchError(`${provider} rejected the API key`, 502);
  }

  if (response.status === 429) {
    throw new WebSearchError(`${provider} rate limit reached, try again later`, 429);
  }

  if (!response.ok) {
    throw new WebSearchError(`${provider} search failed: ${response.status} ${response.statusText}`.trim(), 502);
  }

  return (await response.json()) as T;
}

async function searchTavily(query: string, apiKey: string, maxResults: number, fetchImpl: typeof fetch) {
  const data = await requestJson<{ results?: Array<{ title?: string; url?: string; content?: string }> }>(
    fetchImpl,
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    },
    'Tavily',
  );

  return (data.results ?? []).map((result) => ({
    title: result.title?.trim() ?? '',
    url: result.url ?? '',
    snippet: result.content?.trim() ?? '',
  }));
}

async function searchBrave(query: string, apiKey: string, maxResults: number, fetchImpl: typeof fetch) {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(maxResults));

  const data = await requestJson<{ web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }>(
    fetchImpl,
    url.toString(),
    { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } },
    'Brave Search',
  );

  // Brave wraps matched terms in <strong> tags
  return (data.web?.results ?? []).map((result) => ({
    title: stripTags(result.title ?? ''),
    url: result.url ?? '',
    snippet: stripTags(result.description ?? ''),
  }));
}

/** DuckDuckGo wraps result links in a redirect: `//duckduckgo.com/l/?uddg=<encoded target>`. */
function resolveDuckDuckGoLink(href: string): string {
  try {
    const parsed = new URL(decodeHtmlEntities(href), 'https://duckduckgo.com');
    return parsed.searchParams.get('uddg') ?? parsed.toString();
  } catch {
    return '';
  }
}

export function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*?\bresult\b/i).slice(1);

  for (const block of blocks) {
    // Skip sponsored results
    if (/result--ad\b/.test(block.slice(0, 200))) {
      continue;
    }

    const link = block.match(/<a[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

    if (!link) {
      continue;
    }

    const snippet = block.match(/class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i);

    results.push({
      title: stripTags(link[2]),
      url: resolveDuckDuckGoLink(link[1]),
      snippet: snippet ? stripTags(snippet[1]) : '',
    });
  }

  return results;
}

async function searchDuckDuckGo(query: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html',
    },
    body: new URLSearchParams({ q: query }).toString(),
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  /*
   * DuckDuckGo answers automated traffic it dislikes with a 202 + challenge
   * page rather than an error status, so treat "no parseable results" on a
   * non-200 as a block.
   */
  const html = response.ok ? await response.text() : '';
  const results = parseDuckDuckGoHtml(html);

  if (results.length === 0 && response.status !== 200) {
    throw new WebSearchError(
      'DuckDuckGo blocked the search request. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY for reliable web search.',
      502,
    );
  }

  return results;
}

export async function searchWeb(
  query: string,
  env: WebSearchEnv,
  options: SearchOptions = {},
): Promise<WebSearchResponseData> {
  const { fetchImpl = fetch } = options;
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new WebSearchError('Search query is required', 400);
  }

  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    throw new WebSearchError(`Search query must be at most ${MAX_QUERY_LENGTH} characters`, 400);
  }

  const maxResults = Math.min(Math.max(Math.floor(options.maxResults ?? DEFAULT_MAX_RESULTS), 1), MAX_RESULTS_LIMIT);
  const provider = resolveSearchProvider(env);

  let results: WebSearchResult[];

  switch (provider) {
    case 'tavily': {
      if (!env.TAVILY_API_KEY) {
        throw new WebSearchError('WEB_SEARCH_PROVIDER is "tavily" but TAVILY_API_KEY is not set', 500);
      }

      results = await searchTavily(trimmedQuery, env.TAVILY_API_KEY, maxResults, fetchImpl);
      break;
    }
    case 'brave': {
      if (!env.BRAVE_SEARCH_API_KEY) {
        throw new WebSearchError('WEB_SEARCH_PROVIDER is "brave" but BRAVE_SEARCH_API_KEY is not set', 500);
      }

      results = await searchBrave(trimmedQuery, env.BRAVE_SEARCH_API_KEY, maxResults, fetchImpl);
      break;
    }
    default:
      results = await searchDuckDuckGo(trimmedQuery, fetchImpl);
  }

  return { query: trimmedQuery, provider, results: normalizeResults(results, maxResults) };
}
