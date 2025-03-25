import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

export interface WebSearchResult {
  query: string;
  data: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  error?: string;
}

export function useWebSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WebSearchResult | null>(null);

  /**
   * Performs a web search and returns the results
   * Enhanced to handle various error conditions and ensure compatibility with all LLM models
   */
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return null;
    }

    console.log(`Starting search for: "${query}"`);
    setIsSearching(true);
    setSearchResults(null);

    try {
      // Add query validation
      if (query.length > 500) {
        toast.error('Search query is too long. Please use a shorter query.');
        throw new Error('Search query exceeds maximum length');
      }

      // Log the exact URL we're fetching
      const searchUrl = `/api/websearch?q=${encodeURIComponent(query)}`;
      console.log(`Sending request to: ${searchUrl}`);

      const response = await fetch(searchUrl);

      if (!response.ok) {
        console.error(`Search API returned status ${response.status}: ${response.statusText}`);
        throw new Error(`Search failed: ${response.statusText}`);
      }

      let data: {
        results?: Array<{ title: string; link: string; snippet: string }>;
        error?: string;
      };

      try {
        const responseText = await response.text();
        console.log(`Response received (first 100 chars): ${responseText.substring(0, 100)}...`);
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Error parsing search response:', parseError);
        throw new Error('Failed to parse search results');
      }

      // Validate data structure
      if (!data || ((!data.results || !Array.isArray(data.results)) && !data.error)) {
        console.error('Invalid search response format:', data);
        throw new Error('Invalid search response format');
      }

      // Create a valid result object even if results are empty
      const validResult: WebSearchResult = {
        query,
        data: Array.isArray(data.results) ? data.results : [],
        error: data.error,
      };

      console.log(`Search complete. Found ${validResult.data.length} results`);

      // Update state with a setter function to ensure we're working with the latest state
      setSearchResults(validResult);

      // Wait for state update to be applied
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Return the same result object that we set in state
      return validResult;
    } catch (error) {
      console.error('Search error:', error);

      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

      const errorResult: WebSearchResult = {
        query,
        data: [],
        error: errorMessage,
      };

      setSearchResults(errorResult);
      throw error;
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults(null);
  }, []);

  return {
    searchResults,
    isSearching,
    performSearch,
    clearSearchResults,
  };
}
