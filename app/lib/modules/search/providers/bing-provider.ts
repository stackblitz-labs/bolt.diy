import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

// Define the Bing API response structure for type safety
interface BingSearchResponse {
  _type?: string;
  webPages?: {
    value: Array<{
      id?: string;
      name: string;
      url: string;
      snippet: string;
      dateLastCrawled?: string;
    }>;
    totalEstimatedMatches?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Bing search provider using Microsoft Azure API
 * Offers 1,000 free searches per month
 * https://www.microsoft.com/en-us/bing/apis/bing-web-search-api
 */
export class BingSearchProvider extends BaseSearchProvider {
  name = 'Bing';
  baseUrl = 'https://api.bing.microsoft.com/v7.0/search';

  /**
   * Determines if this provider is suitable for the given query
   * Higher score for general searches and factual queries
   * @param query The search query to check
   * @returns A number between 0 and 1 indicating how suitable this provider is
   */
  getSuitabilityScore(query: string): number {
    const queryLower = query.toLowerCase();

    // Prefer Bing for news-related searches
    if (
      queryLower.includes('news') ||
      queryLower.includes('recent') ||
      queryLower.includes('latest') ||
      queryLower.includes('update')
    ) {
      return 0.9;
    }

    // Good for general searches
    return 0.7;
  }

  /**
   * Performs a search with Bing Web Search API
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  async search(query: string): Promise<SearchResponse> {
    if (!this.apiKey) {
      return {
        results: [],
        error: 'Bing Search API key is not configured',
      };
    }

    try {
      // Construct URL with query parameters
      const url = new URL(this.baseUrl);
      url.searchParams.append('q', query);
      url.searchParams.append('count', '10'); // Number of results to return
      url.searchParams.append('responseFilter', 'Webpages'); // Only return web results
      url.searchParams.append('textDecorations', 'false');
      url.searchParams.append('textFormat', 'raw');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Bing Search API returned status: ${response.status}`);
      }

      const data = (await response.json()) as BingSearchResponse;

      // Map the Bing-specific response to our standard format
      return {
        results: data.webPages?.value
          ? data.webPages.value.map((result) => ({
              title: result.name,
              link: result.url,
              snippet: result.snippet,
            }))
          : [],
        error: data.error?.message,
      };
    } catch (error) {
      console.error('Bing search error:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
