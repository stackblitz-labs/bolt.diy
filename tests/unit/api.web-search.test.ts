import { afterEach, describe, expect, it, vi } from 'vitest';
import { action } from '~/routes/api.web-search';

function post(body: unknown, context: unknown = {}) {
  const request = new Request('http://localhost/api/web-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  return action({ request, context, params: {} } as any);
}

describe('POST /api/web-search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects non-POST requests', async () => {
    const request = new Request('http://localhost/api/web-search', { method: 'PUT' });
    const response = await action({ request, context: {}, params: {} } as any);

    expect(response.status).toBe(405);
  });

  it('rejects invalid JSON', async () => {
    const response = await post('{not json');
    expect(response.status).toBe(400);
  });

  it('requires a url or query', async () => {
    const response = await post({});

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'A URL or search query is required' });
  });

  it('blocks private URLs', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post({ url: 'http://169.254.169.254/' });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches a page for { url }', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<title>Hi</title><p>Body</p>', { headers: { 'content-type': 'text/html' } })),
    );

    const response = await post({ url: 'https://example.com' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      type: 'page',
      data: { title: 'Hi', description: '', content: 'Body', sourceUrl: 'https://example.com' },
    });
  });

  it('searches for { query } using keys from the Cloudflare env', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [{ title: 'A', url: 'https://a.dev', content: 'About' }] })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await post({ query: 'astro', maxResults: 2 }, { cloudflare: { env: { TAVILY_API_KEY: 'k' } } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      type: 'search',
      data: { query: 'astro', provider: 'tavily', results: [{ title: 'A', url: 'https://a.dev', snippet: 'About' }] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.tavily.com/search');
  });

  it('does not leak unexpected error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up at 10.0.0.3')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await post({ url: 'https://example.com' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Web search failed' });
  });
});
