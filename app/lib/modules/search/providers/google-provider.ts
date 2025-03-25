import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

/**
 * Google search provider using Serper.dev API
 */
export class GoogleSearchProvider extends BaseSearchProvider {
  name = 'Google';
  baseUrl = 'https://google.serper.dev/search';

  /**
   * Performs a search with Google via Serper.dev API
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  async search(query: string): Promise<SearchResponse> {
    if (!this.apiKey) {
      return {
        results: [],
        error: 'Google Search API key is not configured',
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
          gl: 'us',
          hl: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`Google Search API returned status: ${response.status}`);
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
      console.error('Google search error:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * Determines if Google is suitable for the given query
   * Google is great for general searches and specific technical documentation
   */
  getSuitabilityScore(query: string): number {
    const queryLower = query.toLowerCase();

    // Higher score for technical queries, documentation, and general knowledge
    if (
      queryLower.includes('how to') ||
      queryLower.includes('tutorial') ||
      queryLower.includes('documentation') ||
      queryLower.includes('guide') ||
      queryLower.includes('example')
    ) {
      return 0.9;
    }

    // Medium-high score for news and current events
    if (
      queryLower.includes('news') ||
      queryLower.includes('latest') ||
      queryLower.includes('update') ||
      queryLower.includes('current')
    ) {
      return 0.8;
    }

    // Google is good for most queries
    return 0.7;
  }
}
