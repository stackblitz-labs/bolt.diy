export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface SearchResponse {
  results: SearchResult[];
  error?: string;
}

/**
 * Base class for all search providers
 */
export abstract class BaseSearchProvider {
  /**
   * The name of the search provider
   */
  abstract name: string;

  /**
   * The base URL for the search provider's API
   */
  abstract baseUrl: string;

  /**
   * The API key for the search provider, if required
   */
  apiKey?: string;

  /**
   * Performs a search with the provider
   * @param query The search query
   * @returns A promise that resolves to the search results
   */
  abstract search(query: string): Promise<SearchResponse>;

  /**
   * Determines if this provider is suitable for the given query
   * @param query The search query to check
   * @returns A number between 0 and 1 indicating how suitable this provider is
   */
  abstract getSuitabilityScore(query: string): number;

  /**
   * Set the API key for this provider
   * @param apiKey The API key
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }
}
