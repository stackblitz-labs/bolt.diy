import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

/**
 * Academic search provider specialized for scholarly and educational content
 * Uses the Serper.dev API with Google Scholar-like queries
 */
export class AcademicSearchProvider extends BaseSearchProvider {
  name = 'Academic';
  baseUrl = 'https://google.serper.dev/search';

  /**
   * Performs an academic search focused on scholarly content
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  async search(query: string): Promise<SearchResponse> {
    if (!this.apiKey) {
      return {
        results: [],
        error: 'Academic Search API key is not configured',
      };
    }

    try {
      // Enhance the query to target academic and scholarly results
      const enhancedQuery = this._enhanceQueryForAcademic(query);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          q: enhancedQuery,
          gl: 'us',
          hl: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error(`Academic Search API returned status: ${response.status}`);
      }

      const data = (await response.json()) as any;

      // Map the response to our standard format
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
      console.error('Academic search error:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * Enhance the query to target academic and scholarly sources
   */
  private _enhanceQueryForAcademic(query: string): string {
    // Don't modify queries that already have academic indicators
    if (query.includes('site:edu') || query.includes('filetype:pdf') || query.includes('site:scholar.google.com')) {
      return query;
    }

    // Add academic sources based on the query content
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes('research') ||
      queryLower.includes('paper') ||
      queryLower.includes('study') ||
      queryLower.includes('journal') ||
      queryLower.includes('thesis') ||
      queryLower.includes('dissertation')
    ) {
      // For explicitly research-oriented queries, search on Google Scholar
      return `${query} site:scholar.google.com OR site:arxiv.org OR site:researchgate.net`;
    } else if (
      queryLower.includes('university') ||
      queryLower.includes('college') ||
      queryLower.includes('course') ||
      queryLower.includes('lecture')
    ) {
      // For academic institution queries
      return `${query} site:.edu OR site:.ac.uk`;
    } else {
      // For general academic queries, make them more scholarly-oriented
      return `${query} academic OR scholarly OR research`;
    }
  }

  /**
   * Determines if the academic provider is suitable for the given query
   */
  getSuitabilityScore(query: string): number {
    const queryLower = query.toLowerCase();

    // Higher score for explicitly academic or research queries
    if (
      queryLower.includes('research') ||
      queryLower.includes('paper') ||
      queryLower.includes('scholar') ||
      queryLower.includes('academic') ||
      queryLower.includes('journal') ||
      queryLower.includes('study') ||
      queryLower.includes('thesis') ||
      queryLower.includes('dissertation') ||
      queryLower.includes('university') ||
      queryLower.includes('college') ||
      queryLower.includes('theory') ||
      queryLower.includes('science')
    ) {
      return 0.95;
    }

    // Medium score for educational queries
    if (
      queryLower.includes('learn') ||
      queryLower.includes('course') ||
      queryLower.includes('education') ||
      queryLower.includes('lecture') ||
      queryLower.includes('textbook')
    ) {
      return 0.8;
    }

    // Low-medium score for general knowledge queries
    if (queryLower.includes('what is') || queryLower.includes('define') || queryLower.includes('meaning of')) {
      return 0.6;
    }

    // Lower baseline for other queries
    return 0.3;
  }
}
