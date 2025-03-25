import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

/**
 * DuckDuckGo search provider
 * Uses the Serper.dev API with DuckDuckGo as the engine
 */
export class DuckDuckGoSearchProvider extends BaseSearchProvider {
  name = 'DuckDuckGo';
  baseUrl = 'https://duckduckgo.serper.dev/search';

  /**
   * Performs a search with DuckDuckGo via Serper.dev API
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  async search(query: string): Promise<SearchResponse> {
    if (!this.apiKey) {
      return {
        results: [],
        error: 'DuckDuckGo Search API key is not configured',
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          q: query,
        }),
      });

      if (!response.ok) {
        throw new Error(`DuckDuckGo Search API returned status: ${response.status}`);
      }

      const data = (await response.json()) as any;

      // Map the Serper-specific response to our standard format
      return {
        results: data.organic
          ? data.organic.map((result: any) => ({
              title: result.title,
              link: result.link,
              snippet: result.snippet,
            }))
          : [],
        error: data.error,
      };
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * Determines if DuckDuckGo is suitable for the given query
   * DuckDuckGo is better for privacy-focused searches and less biased results
   */
  getSuitabilityScore(query: string): number {
    const queryLower = query.toLowerCase();

    // Higher score for privacy-related queries
    if (
      queryLower.includes('privacy') ||
      queryLower.includes('tracking') ||
      queryLower.includes('surveillance') ||
      queryLower.includes('anonymity') ||
      queryLower.includes('private')
    ) {
      return 0.95;
    }

    // Higher for alternative viewpoints and less commercial content
    if (queryLower.includes('alternative') || queryLower.includes('unbiased') || queryLower.includes('independent')) {
      return 0.85;
    }

    // DuckDuckGo is decent for most queries
    return 0.6;
  }
}
