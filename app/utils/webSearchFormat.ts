import type { WebPageContent, WebSearchResult } from '~/types/web-search';

/*
 * Per-result cap on fetched page text, so adding several full pages doesn't
 * blow past small models' context windows.
 */
export const MAX_RESULT_PAGE_CONTENT = 3000;

/** Formats a fetched page as a block of context to prepend to the chat input. */
export function formatPageContent(data: WebPageContent): string {
  const parts: string[] = [`[Web content from ${data.sourceUrl}]`];

  if (data.title) {
    parts.push(`Title: ${data.title}`);
  }

  if (data.description) {
    parts.push(`Description: ${data.description}`);
  }

  parts.push('', data.content);

  return parts.join('\n');
}

/**
 * Formats selected search results (optionally with their fetched page content,
 * keyed by result URL) as a block of context to prepend to the chat input.
 */
export function formatSearchResults(
  query: string,
  results: WebSearchResult[],
  pageContents: Record<string, WebPageContent> = {},
): string {
  const sections = results.map((result, index) => {
    const lines = [`${index + 1}. ${result.title}`, `   URL: ${result.url}`];

    if (result.snippet) {
      lines.push(`   ${result.snippet}`);
    }

    const page = pageContents[result.url];

    if (page?.content) {
      const content =
        page.content.length > MAX_RESULT_PAGE_CONTENT
          ? `${page.content.slice(0, MAX_RESULT_PAGE_CONTENT).trimEnd()}...`
          : page.content;

      lines.push('', `   Page content:`, `   ${content}`);
    }

    return lines.join('\n');
  });

  return [`[Web search results for "${query}"]`, '', sections.join('\n\n')].join('\n');
}
