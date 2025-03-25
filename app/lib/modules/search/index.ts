// Import SearchManager for internal use
import { SearchManager } from './search-manager';

// Export the search manager class
export { SearchManager } from './search-manager';

// Export search provider interfaces and base class
export { BaseSearchProvider } from './providers/base-provider';
export type { SearchResult, SearchResponse } from './providers/base-provider';

// Export individual search providers
export { GoogleSearchProvider } from './providers/google-provider';
export { DuckDuckGoSearchProvider } from './providers/duckduckgo-provider';
export { AcademicSearchProvider } from './providers/academic-provider';
export { DevFallbackProvider } from './providers/dev-fallback-provider';

// Export a convenience function to get the search manager instance
export function getSearchManager() {
  return SearchManager.getInstance();
}
