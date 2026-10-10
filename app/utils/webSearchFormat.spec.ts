import { describe, expect, it } from 'vitest';
import { MAX_RESULT_PAGE_CONTENT, formatPageContent, formatSearchResults } from './webSearchFormat';

describe('formatPageContent', () => {
  it('includes source, title, description and content', () => {
    const text = formatPageContent({
      title: 'Docs',
      description: 'The docs',
      content: 'Hello world',
      sourceUrl: 'https://example.com/docs',
    });

    expect(text).toBe('[Web content from https://example.com/docs]\nTitle: Docs\nDescription: The docs\n\nHello world');
  });

  it('omits empty title and description', () => {
    const text = formatPageContent({ title: '', description: '', content: 'Body', sourceUrl: 'https://a.dev' });
    expect(text).toBe('[Web content from https://a.dev]\n\nBody');
  });
});

describe('formatSearchResults', () => {
  const results = [
    { title: 'First', url: 'https://one.dev', snippet: 'Snippet one' },
    { title: 'Second', url: 'https://two.dev', snippet: '' },
  ];

  it('numbers results and includes URLs and snippets', () => {
    const text = formatSearchResults('vite config', results);

    expect(text).toContain('[Web search results for "vite config"]');
    expect(text).toContain('1. First\n   URL: https://one.dev\n   Snippet one');
    expect(text).toContain('2. Second\n   URL: https://two.dev');
    expect(text).not.toContain('Page content');
  });

  it('appends fetched page content for matching results', () => {
    const text = formatSearchResults('q', results, {
      'https://two.dev': { title: 'Second', description: '', content: 'Full page', sourceUrl: 'https://two.dev' },
    });

    expect(text).toContain('2. Second\n   URL: https://two.dev\n\n   Page content:\n   Full page');
  });

  it('caps page content per result', () => {
    const longContent = 'x'.repeat(MAX_RESULT_PAGE_CONTENT + 100);

    const text = formatSearchResults('q', [results[0]], {
      'https://one.dev': { title: '', description: '', content: longContent, sourceUrl: 'https://one.dev' },
    });

    expect(text).toContain(`${'x'.repeat(MAX_RESULT_PAGE_CONTENT)}...`);
    expect(text).not.toContain('x'.repeat(MAX_RESULT_PAGE_CONTENT + 1));
  });
});
