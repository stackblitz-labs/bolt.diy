export type { WebPageContent, WebSearchProviderId, WebSearchResponseData, WebSearchResult } from '~/types/web-search';

/** Error carrying the HTTP status the API route should respond with. */
export class WebSearchError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
  ) {
    super(message);
    this.name = 'WebSearchError';
  }
}
