import type { ActionFunctionArgs } from 'react-router';
import { fetchPageContent } from '~/lib/.server/web-search/fetch-page';
import { searchWeb, type WebSearchEnv } from '~/lib/.server/web-search/search';
import { WebSearchError } from '~/lib/.server/web-search/types';

interface WebSearchRequestBody {
  url?: unknown;
  query?: unknown;
  maxResults?: unknown;
}

/*
 * Search provider keys come from the server environment only (Cloudflare
 * bindings first, then .env.local via process.env) so they never reach the
 * browser.
 */
function getSearchEnv(context: ActionFunctionArgs['context']): WebSearchEnv {
  const cloudflareEnv: Partial<Env> = context?.cloudflare?.env ?? {};
  const processEnv = typeof process !== 'undefined' ? process.env : {};

  // Empty strings (e.g. `TAVILY_API_KEY=` copied from .env.example) count as unset
  const pick = (key: 'WEB_SEARCH_PROVIDER' | 'TAVILY_API_KEY' | 'BRAVE_SEARCH_API_KEY') =>
    cloudflareEnv[key]?.trim() || processEnv[key]?.trim() || undefined;

  return {
    WEB_SEARCH_PROVIDER: pick('WEB_SEARCH_PROVIDER'),
    TAVILY_API_KEY: pick('TAVILY_API_KEY'),
    BRAVE_SEARCH_API_KEY: pick('BRAVE_SEARCH_API_KEY'),
  };
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
      const data = await searchWeb(body.query, getSearchEnv(context), { maxResults });

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
