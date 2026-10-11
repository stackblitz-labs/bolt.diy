import type { ActionFunctionArgs } from 'react-router';
import { getWebSearchEnv } from '~/lib/.server/web-search/env';
import { fetchPageContent } from '~/lib/.server/web-search/fetch-page';
import { searchWeb } from '~/lib/.server/web-search/search';
import { WebSearchError } from '~/lib/.server/web-search/types';

interface WebSearchRequestBody {
  url?: unknown;
  query?: unknown;
  maxResults?: unknown;
}

/**
 * POST /api/web-search
 *
 * - `{ url }`   fetches a single public page and returns its readable content.
 * - `{ query }` runs a web search and returns a list of results.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: WebSearchRequestBody;

  try {
    body = (await request.json()) as WebSearchRequestBody;
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }

  try {
    if (typeof body?.url === 'string' && body.url.trim()) {
      const data = await fetchPageContent(body.url.trim());
      return Response.json({ success: true, type: 'page', data });
    }

    if (typeof body?.query === 'string' && body.query.trim()) {
      const maxResults = typeof body.maxResults === 'number' ? body.maxResults : undefined;
      const data = await searchWeb(body.query, getWebSearchEnv(context?.cloudflare?.env), { maxResults });

      return Response.json({ success: true, type: 'search', data });
    }

    return Response.json({ error: 'A URL or search query is required' }, { status: 400 });
  } catch (error) {
    if (error instanceof WebSearchError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return Response.json({ error: 'Request timed out after 10 seconds' }, { status: 504 });
    }

    console.error('Web search error:', error);

    return Response.json({ error: 'Web search failed' }, { status: 500 });
  }
}
