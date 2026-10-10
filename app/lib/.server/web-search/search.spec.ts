import { describe, expect, it, vi } from 'vitest';
import { parseDuckDuckGoHtml, resolveSearchProvider, searchWeb } from './search';

const DDG_HTML = `
<div id="links" class="results">
  <div class="result results_links results_links_deep result--ad ">
    <div class="links_main links_deep result__body">
      <h2 class="result__title"><a rel="nofollow" class="result__a" href="https://ads.example.com/click">Sponsored</a></h2>
      <a class="result__snippet" href="https://ads.example.com/click">Buy now</a>
    </div>
  </div>
  <div class="result results_links results_links_deep web-result ">
    <div class="links_main links_deep result__body">
      <h2 class="result__title">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Flearn&amp;rut=abc">React &amp; <b>Hooks</b></a>
      </h2>
      <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Flearn">Learn <b>React</b> hooks</a>
    </div>
  </div>
  <div class="result results_links results_links_deep web-result ">
    <div class="links_main links_deep result__body">
      <h2 class="result__title"><a rel="nofollow" class="result__a" href="https://vite.dev/guide/">Vite Guide</a></h2>
    </div>
  </div>
</div>`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('resolveSearchProvider', () => {
  it('falls back to DuckDuckGo without keys', () => {
    expect(resolveSearchProvider({})).toBe('duckduckgo');
  });

  it('prefers Tavily, then Brave, when keys are present', () => {
    expect(resolveSearchProvider({ TAVILY_API_KEY: 't', BRAVE_SEARCH_API_KEY: 'b' })).toBe('tavily');
    expect(resolveSearchProvider({ BRAVE_SEARCH_API_KEY: 'b' })).toBe('brave');
  });

  it('honours an explicit WEB_SEARCH_PROVIDER', () => {
    expect(resolveSearchProvider({ WEB_SEARCH_PROVIDER: ' Brave ', TAVILY_API_KEY: 't' })).toBe('brave');
    expect(resolveSearchProvider({ WEB_SEARCH_PROVIDER: 'duckduckgo', TAVILY_API_KEY: 't' })).toBe('duckduckgo');
  });

  it('ignores unknown WEB_SEARCH_PROVIDER values', () => {
    expect(resolveSearchProvider({ WEB_SEARCH_PROVIDER: 'bing', TAVILY_API_KEY: 't' })).toBe('tavily');
  });
});

describe('parseDuckDuckGoHtml', () => {
  it('extracts organic results, skips ads and unwraps redirect links', () => {
    expect(parseDuckDuckGoHtml(DDG_HTML)).toEqual([
      { title: 'React & Hooks', url: 'https://react.dev/learn', snippet: 'Learn React hooks' },
      { title: 'Vite Guide', url: 'https://vite.dev/guide/', snippet: '' },
    ]);
  });

  it('returns nothing for pages without results', () => {
    expect(parseDuckDuckGoHtml('<html><body>Challenge</body></html>')).toEqual([]);
  });
});

describe('searchWeb', () => {
  it('validates the query', async () => {
    await expect(searchWeb('   ', {})).rejects.toMatchObject({ status: 400 });
    await expect(searchWeb('x'.repeat(401), {})).rejects.toMatchObject({ status: 400 });
  });

  it('calls Tavily with a bearer token and maps results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({
        results: [
          { title: 'A', url: 'https://a.dev', content: 'About A' },
          { title: 'Local', url: 'http://localhost:3000', content: 'filtered' },
          { title: 'A again', url: 'https://a.dev', content: 'duplicate' },
        ],
      }),
    );

    const data = await searchWeb(' tailwind ', { TAVILY_API_KEY: 'tvly-key' }, { fetchImpl, maxResults: 3 });

    expect(data).toEqual({
      query: 'tailwind',
      provider: 'tavily',
      results: [{ title: 'A', url: 'https://a.dev', snippet: 'About A' }],
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/search');
    expect(init.headers.Authorization).toBe('Bearer tvly-key');
    expect(JSON.parse(init.body)).toMatchObject({ query: 'tailwind', max_results: 3 });
  });

  it('calls Brave with the subscription header and strips highlight tags', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      json({
        web: {
          results: [{ title: '<strong>Vite</strong> docs', url: 'https://vite.dev', description: 'Fast &amp; lean' }],
        },
      }),
    );

    const data = await searchWeb('vite', { BRAVE_SEARCH_API_KEY: 'brave-key' }, { fetchImpl });

    expect(data.provider).toBe('brave');
    expect(data.results).toEqual([{ title: 'Vite docs', url: 'https://vite.dev', snippet: 'Fast & lean' }]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).searchParams.get('q')).toBe('vite');
    expect(new URL(url).searchParams.get('count')).toBe('5');
    expect(init.headers['X-Subscription-Token']).toBe('brave-key');
  });

  it('clamps maxResults to the allowed range', async () => {
    const results = Array.from({ length: 20 }, (_, i) => ({ title: `R${i}`, url: `https://r${i}.dev`, content: '' }));
    const fetchImpl = vi.fn().mockResolvedValue(json({ results }));

    const data = await searchWeb('q', { TAVILY_API_KEY: 'k' }, { fetchImpl, maxResults: 50 });

    expect(data.results).toHaveLength(10);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).max_results).toBe(10);
  });

  it('reports a rejected API key clearly', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ error: 'unauthorized' }, 401));

    await expect(searchWeb('q', { TAVILY_API_KEY: 'bad' }, { fetchImpl })).rejects.toMatchObject({
      status: 502,
      message: 'Tavily rejected the API key',
    });
  });

  it('passes rate limits through as 429', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 429));

    await expect(searchWeb('q', { BRAVE_SEARCH_API_KEY: 'k' }, { fetchImpl })).rejects.toMatchObject({ status: 429 });
  });

  it('errors when a forced provider has no key', async () => {
    await expect(searchWeb('q', { WEB_SEARCH_PROVIDER: 'tavily' })).rejects.toThrow(/TAVILY_API_KEY is not set/);
  });

  it('uses DuckDuckGo when no keys are configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(DDG_HTML, { headers: { 'content-type': 'text/html' } }));

    const data = await searchWeb('react hooks', {}, { fetchImpl });

    expect(data.provider).toBe('duckduckgo');
    expect(data.results.map((r) => r.url)).toEqual(['https://react.dev/learn', 'https://vite.dev/guide/']);
    expect(fetchImpl.mock.calls[0][1].body).toBe('q=react+hooks');
  });

  it('explains how to fix a DuckDuckGo block', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('challenge', { status: 202 }));

    await expect(searchWeb('q', {}, { fetchImpl })).rejects.toThrow(/Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY/);
  });
});
