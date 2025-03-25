import { BaseSearchProvider } from './base-provider';
import type { SearchResponse } from './base-provider';

interface PerplexitySearchResponse {
  id: string;
  choices: Array<{
    index: number;
    text: string;
    search_queries?: string[];
    search_results?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

/**
 * Perplexity search provider using their Sonar models with built-in search
 * https://docs.perplexity.ai/docs/model-cards
 */
export class PerplexitySearchProvider extends BaseSearchProvider {
  name = 'Perplexity';
  baseUrl = 'https://api.perplexity.ai/chat/completions';

  /**
   * Determines if this provider is suitable for the given query
   * Higher score for complex, academic, or research questions
   * @param query The search query to check
   * @returns A number between 0 and 1 indicating how suitable this provider is
   */
  getSuitabilityScore(query: string): number {
    const queryLower = query.toLowerCase();

    // Prefer Perplexity for academic or complex searches
    if (
      queryLower.includes('research') ||
      queryLower.includes('paper') ||
      queryLower.includes('academic') ||
      queryLower.includes('study') ||
      queryLower.includes('explain')
    ) {
      return 0.95;
    }

    // Good for detailed questions
    return 0.8;
  }

  /**
   * Performs a search with Perplexity API using Sonar models
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  async search(query: string): Promise<SearchResponse> {
    if (!this.apiKey) {
      return {
        results: [],
        error: 'Perplexity API key is not configured',
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online', // One of Perplexity's models with web search
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant with web search capabilities. Search the web for information and provide informative, factual results.',
            },
            {
              role: 'user',
              content: query,
            },
          ],
          stream: false,
          search_queries: [query], // Explicitly tell Perplexity to search for this query
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API returned status: ${response.status}`);
      }

      const data = (await response.json()) as PerplexitySearchResponse;

      // If no search results in the response, return an empty array with an error
      if (!data.choices[0]?.search_results || data.choices[0].search_results.length === 0) {
        return {
          results: [],
          error: 'No search results found for this query',
        };
      }

      // Map the Perplexity-specific response to our standard format
      return {
        results: data.choices[0].search_results.map((result) => ({
          title: result.title,
          link: result.url,
          snippet: result.snippet,
        })),
        error: data.error?.message,
      };
    } catch (error) {
      console.error('Perplexity search error:', error);
      return {
        results: [],
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }
}
