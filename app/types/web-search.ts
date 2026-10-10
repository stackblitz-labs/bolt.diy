export type WebSearchProviderId = 'tavily' | 'brave' | 'duckduckgo';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponseData {
  query: string;
  provider: WebSearchProviderId;
  results: WebSearchResult[];
}

export interface WebPageContent {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
}

export type WebSearchApiResponse =
  | { success: true; type: 'page'; data: WebPageContent }
  | { success: true; type: 'search'; data: WebSearchResponseData }
  | { success?: false; error: string };
