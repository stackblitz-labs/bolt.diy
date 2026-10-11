import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebMcpTools } from './mcp-tools';

type Execute = (input: unknown, options?: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;

function getTool(name: 'web_search' | 'fetch_url') {
  const tool = createWebMcpTools()[name] as { description?: string; execute: Execute };
  return tool;
}

function text(result: Awaited<ReturnType<Execute>>) {
  return result.content.map((part) => part.text).join('\n');
}

describe('built-in web MCP tools', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes web_search and fetch_url with descriptions', () => {
    const tools = createWebMcpTools();

    expect(Object.keys(tools)).toEqual(['web_search', 'fetch_url']);
    expect(tools.web_search.description).toMatch(/Search the web/);
    expect(tools.fetch_url.description).toMatch(/Fetch a public web page/);
  });

  it('web_search uses the provider keys passed in the call context', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [{ title: 'Zod docs', url: 'https://zod.dev', content: 'Schemas' }] })),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTool('web_search').execute(
      { query: 'zod v4', max_results: 2 },
      { context: { webSearchEnv: { TAVILY_API_KEY: 'tvly' } } },
    );

    expect(result.isError).toBeUndefined();
    expect(text(result)).toContain('[Web search results for "zod v4"]');
    expect(text(result)).toContain('1. Zod docs\n   URL: https://zod.dev\n   Schemas');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.tavily.com/search');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_results).toBe(2);
  });

  it('web_search reports empty results in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }))));

    const result = await getTool('web_search').execute(
      { query: 'nothing' },
      { context: { webSearchEnv: { TAVILY_API_KEY: 'k' } } },
    );

    expect(text(result)).toBe('No results found for "nothing".');
  });

  it('returns invalid arguments to the model as an error result', async () => {
    const result = await getTool('web_search').execute({ query: '' });

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^Invalid arguments: query/);
  });

  it('returns provider failures to the model as an error result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const result = await getTool('web_search').execute(
      { query: 'q' },
      { context: { webSearchEnv: { BRAVE_SEARCH_API_KEY: 'bad' } } },
    );

    expect(result).toEqual({ content: [{ type: 'text', text: 'Brave Search rejected the API key' }], isError: true });
  });

  it('fetch_url returns the readable page content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<title>Guide</title><main><p>Install it</p></main>', {
          headers: { 'content-type': 'text/html' },
        }),
      ),
    );

    const result = await getTool('fetch_url').execute({ url: 'https://example.com/guide' });

    expect(text(result)).toBe('[Web content from https://example.com/guide]\nTitle: Guide\n\nInstall it');
  });

  it('fetch_url refuses private addresses without making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await getTool('fetch_url').execute({ url: 'http://169.254.169.254/latest/meta-data/' });

    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/not allowed/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak unexpected error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.7:443')));

    const result = await getTool('fetch_url').execute({ url: 'https://example.com' });

    expect(result).toEqual({ content: [{ type: 'text', text: 'Request failed' }], isError: true });
  });
});
