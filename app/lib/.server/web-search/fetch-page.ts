import { extractMetaDescription, extractTextContent, extractTitle, truncate } from './html';
import { WebSearchError, type WebPageContent } from './types';
import { isAllowedUrl } from '~/utils/url';

export const MAX_PAGE_CONTENT_LENGTH = 8000;

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * `fetch` wrapper for user-supplied URLs. Redirects are followed manually so
 * every hop is re-checked against the SSRF allow-list — otherwise a public URL
 * could simply redirect to `http://169.254.169.254/` or `http://localhost`.
 */
export async function safeFetch(url: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch) {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedUrl(currentUrl)) {
      throw new WebSearchError(
        hop === 0
          ? 'URL is not allowed. Only public HTTP/HTTPS URLs are accepted.'
          : 'URL redirected to a location that is not allowed.',
        400,
      );
    }

    const response = await fetchImpl(currentUrl, { ...init, redirect: 'manual' });

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get('location');

    if (!location) {
      return { response, finalUrl: currentUrl };
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new WebSearchError(`Too many redirects (more than ${MAX_REDIRECTS})`, 502);
}

/** Reads a response body as text, refusing to buffer more than `maxBytes`. */
async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));

  if (declaredLength > maxBytes) {
    throw new WebSearchError('Page is too large to fetch', 413);
  }

  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let received = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    received += value.byteLength;

    if (received > maxBytes) {
      await reader.cancel();

      // Large pages still have useful content up front, so keep what we have
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

export async function fetchPageContent(
  url: string,
  options: { maxLength?: number; fetchImpl?: typeof fetch } = {},
): Promise<WebPageContent> {
  const { maxLength = MAX_PAGE_CONTENT_LENGTH, fetchImpl = fetch } = options;

  const { response, finalUrl } = await safeFetch(
    url,
    { headers: FETCH_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    fetchImpl,
  );

  if (!response.ok) {
    throw new WebSearchError(`Failed to fetch URL: ${response.status} ${response.statusText}`.trim(), 502);
  }

  const contentType = response.headers.get('content-type') || '';
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');

  if (!isHtml && !contentType.includes('text/plain') && !contentType.includes('text/markdown')) {
    throw new WebSearchError('URL must point to an HTML or text page', 415);
  }

  const body = await readTextWithLimit(response, MAX_RESPONSE_BYTES);

  if (!isHtml) {
    return { title: '', description: '', content: truncate(body.trim(), maxLength), sourceUrl: finalUrl };
  }

  return {
    title: extractTitle(body),
    description: extractMetaDescription(body),
    content: truncate(extractTextContent(body), maxLength),
    sourceUrl: finalUrl,
  };
}
