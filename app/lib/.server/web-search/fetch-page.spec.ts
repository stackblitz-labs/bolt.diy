import { describe, expect, it, vi } from 'vitest';
import { fetchPageContent, safeFetch } from './fetch-page';
import { WebSearchError } from './types';

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

function html(body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
}

describe('safeFetch', () => {
  it('rejects disallowed URLs without fetching', async () => {
    const fetchImpl = vi.fn();

    await expect(safeFetch('http://127.0.0.1/', {}, fetchImpl)).rejects.toThrow(/not allowed/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('follows public redirects and reports the final URL', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect('/docs'))
      .mockResolvedValueOnce(redirect('https://www.example.com/docs', 301))
      .mockResolvedValueOnce(html('<p>ok</p>'));

    const { response, finalUrl } = await safeFetch('https://example.com/', {}, fetchImpl);

    expect(response.status).toBe(200);
    expect(finalUrl).toBe('https://www.example.com/docs');
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://example.com/docs', { redirect: 'manual' });
  });

  it('blocks redirects to private addresses (SSRF)', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(redirect('http://169.254.169.254/latest/meta-data/'));

    await expect(safeFetch('https://example.com/', {}, fetchImpl)).rejects.toThrow(/redirected to a location/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => redirect('https://example.com/loop'));

    await expect(safeFetch('https://example.com/', {}, fetchImpl)).rejects.toThrow(/Too many redirects/);
  });
});

describe('fetchPageContent', () => {
  it('extracts title, description and readable content', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        html(
          '<html><head><title>Example</title><meta name="description" content="Desc"></head>' +
            '<body><nav>Nav</nav><p>Main text</p></body></html>',
        ),
      );

    await expect(fetchPageContent('https://example.com', { fetchImpl })).resolves.toEqual({
      title: 'Example',
      description: 'Desc',
      content: 'Main text',
      sourceUrl: 'https://example.com',
    });
  });

  it('truncates long content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(html(`<p>${'word '.repeat(100)}</p>`));
    const page = await fetchPageContent('https://example.com', { fetchImpl, maxLength: 20 });

    expect(page.content).toBe('word word word word...');
  });

  it('returns plain text as-is', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('  plain text  ', { headers: { 'content-type': 'text/plain' } }));

    const page = await fetchPageContent('https://example.com/readme.txt', { fetchImpl });

    expect(page).toMatchObject({ title: '', content: 'plain text' });
  });

  it('rejects non-text content types', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }));

    await expect(fetchPageContent('https://example.com/api', { fetchImpl })).rejects.toMatchObject({ status: 415 });
  });

  it('maps upstream errors to a 502', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 404, statusText: 'Not Found' }));
    const error = await fetchPageContent('https://example.com/missing', { fetchImpl }).catch((e) => e);

    expect(error).toBeInstanceOf(WebSearchError);
    expect(error).toMatchObject({ status: 502, message: 'Failed to fetch URL: 404 Not Found' });
  });

  it('refuses pages that declare a huge content-length', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(html('<p>x</p>', { 'content-length': String(50 * 1024 * 1024) }));

    await expect(fetchPageContent('https://example.com', { fetchImpl })).rejects.toMatchObject({ status: 413 });
  });
});
