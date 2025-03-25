import { json } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { SearchManager } from '~/lib/modules/search/search-manager';

/**
 * Retrieves API keys from environment variables
 */
function getSearchApiKeys() {
  const keys: Record<string, string> = {};

  // Add Serper.dev API key for Google, DuckDuckGo, and Academic
  if (process.env.SERPER_API_KEY) {
    keys.Google = process.env.SERPER_API_KEY;
    keys.DuckDuckGo = process.env.SERPER_API_KEY;
    keys.Academic = process.env.SERPER_API_KEY;
  }

  // Add Bing Search API key
  if (process.env.BING_SEARCH_API_KEY) {
    keys.Bing = process.env.BING_SEARCH_API_KEY;
  }

  // Add Perplexity API key
  if (process.env.PERPLEXITY_API_KEY) {
    keys.Perplexity = process.env.PERPLEXITY_API_KEY;
  }

  /*
   * Add any provider-specific API keys here if they differ
   * Example: if (process.env.GOOGLE_API_KEY) keys.Google = process.env.GOOGLE_API_KEY;
   */

  return keys;
}

/**
 * Checks if we're running in development mode
 */
function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development';
}

/*
 * Function to handle a web search request (GET)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
      return json({ error: 'Search query is required' }, { status: 400 });
    }

    console.log(`Processing search request for: ${query}`);

    // Initialize the search manager
    const searchManager = SearchManager.getInstance();
    const apiKeys = getSearchApiKeys();
    const isDevMode = isDevelopmentMode();

    searchManager.setApiKeys(apiKeys);
    searchManager.setDevelopmentMode(isDevMode);

    // Perform the search
    const searchResults = await searchManager.search(query);

    return json(searchResults);
  } catch (error) {
    console.error('Error processing search request:', error);
    return json(
      { error: 'Failed to process search request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/*
 * Function to handle a web search request (POST)
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const query = body && typeof body === 'object' && 'query' in body ? (body.query as string) : undefined;

    if (!query) {
      return json({ error: 'Search query is required' }, { status: 400 });
    }

    console.log(`Processing POST search request for: ${query}`);

    // Initialize the search manager
    const searchManager = SearchManager.getInstance();
    const apiKeys = getSearchApiKeys();
    const isDevMode = isDevelopmentMode();

    searchManager.setApiKeys(apiKeys);
    searchManager.setDevelopmentMode(isDevMode);

    // Perform the search
    const searchResults = await searchManager.search(query);

    return json(searchResults);
  } catch (error) {
    console.error('Error processing search request:', error);
    return json(
      { error: 'Failed to process search request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
