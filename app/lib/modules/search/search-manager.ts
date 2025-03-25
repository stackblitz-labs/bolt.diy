import { BaseSearchProvider } from './providers/base-provider';
import type { SearchResponse } from './providers/base-provider';
import { GoogleSearchProvider } from './providers/google-provider';
import { DuckDuckGoSearchProvider } from './providers/duckduckgo-provider';
import { AcademicSearchProvider } from './providers/academic-provider';
import { BingSearchProvider } from './providers/bing-provider';
import { PerplexitySearchProvider } from './providers/perplexity-provider';
import { DevFallbackProvider } from './providers/dev-fallback-provider';

/**
 * Manages search providers and selects the optimal one for a given query
 */
export class SearchManager {
  private static _instance: SearchManager;
  private _providers: BaseSearchProvider[] = [];
  private _apiKeys: Record<string, string> = {};
  private _isDevelopment: boolean = false;
  private _devFallbackProvider: DevFallbackProvider | null = null;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {
    // Add production-ready providers
    this._providers.push(new GoogleSearchProvider());
    this._providers.push(new DuckDuckGoSearchProvider());
    this._providers.push(new AcademicSearchProvider());
    this._providers.push(new BingSearchProvider());
    this._providers.push(new PerplexitySearchProvider());

    // Create fallback provider (used in both development and production)
    this._devFallbackProvider = new DevFallbackProvider();
  }

  /**
   * Get the singleton instance of SearchManager
   */
  static getInstance(): SearchManager {
    if (!SearchManager._instance) {
      SearchManager._instance = new SearchManager();
    }

    return SearchManager._instance;
  }

  /**
   * Set API keys for the search providers
   * @param keys Object containing API keys for different providers
   */
  setApiKeys(keys: Record<string, string>): void {
    this._apiKeys = keys;

    // Update API keys for all providers
    this._providers.forEach((provider) => {
      if (keys[provider.name]) {
        provider.setApiKey(keys[provider.name]);
      }
    });
  }

  /**
   * Set whether the application is running in development mode
   * This enables additional logging but fallback now works in all modes
   */
  setDevelopmentMode(isDevelopment: boolean): void {
    this._isDevelopment = isDevelopment;
  }

  /**
   * Perform a search with the best provider for the given query
   * Falls back to the DevFallbackProvider when no API keys are configured (both dev and production)
   * @param query The search query
   * @returns Promise with search results
   */
  async search(query: string): Promise<SearchResponse> {
    // Use the fallback provider if no API keys are configured - works in all environments
    if (this._devFallbackProvider) {
      // Check if we have any API keys configured
      const hasApiKeys = Object.keys(this._apiKeys).length > 0;

      if (!hasApiKeys) {
        console.log(`${this._isDevelopment ? '[DEV] ' : ''}No API keys configured, using fallback provider`);
        return this._devFallbackProvider.search(query);
      }
    }

    // Get provider suitability scores
    const scoredProviders = this._providers.map((provider) => ({
      provider,
      score: provider.getSuitabilityScore(query),
      hasApiKey: !!this._apiKeys[provider.name],
    }));

    // Filter out providers without API keys
    const availableProviders = scoredProviders.filter((p) => p.hasApiKey);

    if (availableProviders.length === 0) {
      // Use the fallback provider when no API-configured providers are available
      if (this._devFallbackProvider) {
        console.log(
          `${this._isDevelopment ? '[DEV] ' : ''}No available providers with API keys, using fallback provider`,
        );
        return this._devFallbackProvider.search(query);
      }

      return {
        results: [],
        error: 'No configured search providers available. Please contact the administrator.',
      };
    }

    // Sort by score (highest first)
    availableProviders.sort((a, b) => b.score - a.score);

    // Use the highest-scoring provider
    const bestProvider = availableProviders[0].provider;
    console.log(`Selected search provider: ${bestProvider.name} (score: ${availableProviders[0].score})`);

    return bestProvider.search(query);
  }

  /**
   * Get a specific provider by name
   * @param name The name of the provider
   * @returns The provider or undefined if not found
   */
  getProvider(name: string): BaseSearchProvider | undefined {
    if (name === 'FallbackSearch' && this._devFallbackProvider) {
      return this._devFallbackProvider;
    }

    return this._providers.find((p) => p.name === name);
  }

  /**
   * Get all registered providers
   * @returns Array of providers
   */
  getProviders(): BaseSearchProvider[] {
    const allProviders = [...this._providers];

    // Include fallback provider in the list - works in all environments
    if (this._devFallbackProvider) {
      allProviders.push(this._devFallbackProvider);
    }

    return allProviders;
  }
}
