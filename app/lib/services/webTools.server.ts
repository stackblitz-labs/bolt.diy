/**
 * Keyless web search and bounded public-page fetching for server routes and MCP tools.
 *
 * This portable Workers/Node fetch layer blocks literal private/reserved addresses and
 * rechecks each redirect. It cannot inspect DNS answers or pin a resolved address with
 * the standard fetch API, so deployments that resolve caller-controlled hostnames into
 * private networks must also enforce public-only egress at the runtime/network boundary.
 */

const MAX_FETCH_BYTES = 1_000_000;
const MAX_FETCH_CHARS = 8_000;
const MAX_REDIRECTS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; bolt.diy/1.0; +https://github.com/stackblitz-labs/bolt.diy)',
  Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
  'Accept-Language': 'en-US,en;q=0.5',
};

export interface WebFetchResult {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
  finalUrl: string;
  truncated: boolean;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  // URL normalizes alternate IPv4 spellings (integer, octal, hex) to dotted decimal.
  if (/^\d+(?:\.\d+){0,3}$/.test(host)) {
    const parts = host.split('.').map(Number);

    if (parts.length !== 4 || parts.some((part) => part < 0 || part > 255)) {
      return true;
    }

    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a === 224 ||
      a >= 240
    );
  }

  /*
   * Reject IP-literal IPv6 entirely: global IPv6 is uncommon for fetched pages and
   * conservative rejection avoids loopback, ULA, link-local and mapped-address tricks.
   */
  return host.includes(':') || host.startsWith('[');
}

export function validatePublicHttpUrl(input: string): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error('A valid HTTP or HTTPS URL is required');
  }

  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('Only public HTTP/HTTPS URLs without embedded credentials are allowed');
  }

  if (isBlockedHostname(url.hostname)) {
    throw new Error('Private, local, and reserved network addresses are not allowed');
  }

  return url;
}

async function readBounded(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) {
    return { text: '', truncated: false };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let bytes = 0;
  let text = '';
  let truncated = false;

  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const remaining = maxBytes - bytes;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytes += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });

      if (chunk.byteLength !== value.byteLength) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }

    if (!truncated) {
      text += decoder.decode();
    }

    if (!truncated) {
      // Detect a body that continues beyond the exact byte limit without buffering it.
      const next = await reader.read();
      truncated = !next.done;

      if (truncated) {
        await reader.cancel();
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { text, truncated };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_match, hex: string, decimal: string) => {
      const code = hex ? Number.parseInt(hex, 16) : Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(Math.min(code, 0x10ffff)) : '';
    })
    .replace(/&#x27;/gi, "'");
}

function extractTitle(html: string): string {
  return decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
}

function extractMetaDescription(html: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const name = tag.match(/\bname=["']description["']/i);
    const content = tag.match(/\bcontent=["']([^"']*)["']/i);

    if (name && content) {
      return decodeEntities(content[1]).trim();
    }
  }

  return '';
}

function extractTextContent(html: string): string {
  return decodeEntities(
    html.replace(/<(script|style|nav|header|footer|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export async function webFetch(input: string): Promise<WebFetchResult> {
  const source = validatePublicHttpUrl(input);

  let current = source;

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(new Error('Request timed out after 10 seconds')),
    REQUEST_TIMEOUT_MS,
  );

  try {
    let response: Response | undefined;

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      response = await fetch(current, {
        headers: FETCH_HEADERS,
        signal: controller.signal,
        redirect: 'manual',
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }

      const location = response.headers.get('location');

      if (!location || redirects === MAX_REDIRECTS) {
        await response.body?.cancel();
        throw new Error('The page redirected too many times or returned an invalid redirect');
      }

      await response.body?.cancel();
      current = validatePublicHttpUrl(new URL(location, current).href);
    }

    if (!response) {
      throw new Error('Failed to fetch URL');
    }

    if (response.status === 429) {
      await response.body?.cancel();
      throw new Error('The website rate limited this request. Try again later.');
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      await response.body?.cancel();
      throw new Error('URL must point to an HTML or text page');
    }

    const declaredLength = Number(response.headers.get('content-length'));

    if (Number.isFinite(declaredLength) && declaredLength > MAX_FETCH_BYTES) {
      await response.body?.cancel();
      throw new Error('Page is larger than the 1 MB fetch limit');
    }

    const read = await readBounded(response, MAX_FETCH_BYTES);
    const title = extractTitle(read.text);
    const description = extractMetaDescription(read.text);
    const fullContent = extractTextContent(read.text);
    const truncated = read.truncated || fullContent.length > MAX_FETCH_CHARS;

    return {
      title: title.slice(0, 500),
      description: description.slice(0, 1_000),
      content: truncated ? `${fullContent.slice(0, MAX_FETCH_CHARS)}...` : fullContent,
      sourceUrl: source.href,
      finalUrl: current.href,
      truncated,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Request timed out after 10 seconds');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeSearchUrl(href: string): string | undefined {
  try {
    const decoded = new URL(href, SEARCH_ENDPOINT);
    const target = decoded.searchParams.get('uddg');
    const result = validatePublicHttpUrl(target ?? decoded.href);

    if (result.hostname === 'html.duckduckgo.com' || result.href.length > 2_048) {
      return undefined;
    }

    return result.href;
  } catch {
    return undefined;
  }
}

export async function webSearch(query: string, limit = 8): Promise<WebSearchResult[]> {
  const normalized = query.trim();

  if (!normalized || normalized.length > 500) {
    throw new Error('Search query must be between 1 and 500 characters');
  }

  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set('q', normalized);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal, redirect: 'error' });

    if (response.status === 429) {
      throw new Error('DuckDuckGo rate limited web search. Try again later.');
    }

    if (!response.ok) {
      throw new Error(`Web search failed: ${response.status} ${response.statusText}`);
    }

    const type = response.headers.get('content-type')?.toLowerCase() ?? '';

    if (!type.includes('text/html')) {
      throw new Error('Web search returned an unexpected response');
    }

    const { text: html } = await readBounded(response, 1_000_000);

    if (/captcha|anomaly-modal|challenge-form/i.test(html)) {
      throw new Error('DuckDuckGo presented a search challenge. Try again later.');
    }

    const results: WebSearchResult[] = [];

    const blocks =
      html.match(
        /<div\b[^>]*class=["'][^"']*result\b[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*class=["'][^"']*result\b|$)/gi,
      ) ?? [];

    for (const block of blocks) {
      const anchor = block.match(
        /<a\b[^>]*class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
      );

      if (!anchor) {
        continue;
      }

      const resultUrl = decodeSearchUrl(decodeEntities(anchor[1]));

      if (!resultUrl) {
        continue;
      }

      const snippet =
        block.match(
          /<(?:a|div|td)\b[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|td)>/i,
        )?.[1] ?? '';
      results.push({
        title: stripTags(anchor[2]).slice(0, 300),
        url: resultUrl,
        snippet: stripTags(snippet).slice(0, 1_000),
      });

      if (results.length >= safeLimit) {
        break;
      }
    }

    if (!results.length && /no-results|no result/i.test(html)) {
      return [];
    }

    if (!results.length) {
      throw new Error('DuckDuckGo returned no readable results, possibly due to a response challenge');
    }

    return results;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('Web search timed out after 10 seconds');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
