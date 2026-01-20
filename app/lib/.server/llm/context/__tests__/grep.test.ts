/**
 * Tests for Grep Fallback Functions
 *
 * Tests the grepForSpecificText() function and pattern extraction logic
 * for User Story 3: Specific Text Search via Grep Fallback.
 */

import { describe, it, expect } from 'vitest';
import { grepForSpecificText, extractPatterns } from '~/lib/.server/llm/context/grep';
import type { FileMap } from '~/lib/.server/llm/constants';

describe('extractPatterns', () => {
  it('extracts quoted strings from query', () => {
    const patterns = extractPatterns('change "Open 9am-10pm" to "Open 8am-11pm"');
    expect(patterns).toContain('Open 9am-10pm');
    expect(patterns).toContain('Open 8am-11pm');
    expect(patterns).toHaveLength(2);
  });

  it('extracts single-quoted strings from query', () => {
    const patterns = extractPatterns("update the text 'Hello World' please");
    expect(patterns).toContain('Hello World');
    expect(patterns).toHaveLength(1);
  });

  it('extracts price patterns from query', () => {
    const patterns = extractPatterns('change $14 to $16');
    expect(patterns).toContain('$14');
    expect(patterns).toContain('$16');
    expect(patterns).toHaveLength(2);
  });

  it('extracts prices with cents from query', () => {
    const patterns = extractPatterns('update $14.99 to $16.50');
    expect(patterns).toContain('$14.99');
    expect(patterns).toContain('$16.50');
    expect(patterns).toHaveLength(2);
  });

  it('extracts hex colors (6 digits) from query', () => {
    const patterns = extractPatterns('change the color to #21C6FF');
    expect(patterns).toContain('#21C6FF');
    expect(patterns).toHaveLength(1);
  });

  it('extracts hex colors (3 digits) from query', () => {
    const patterns = extractPatterns('use #fff for background');
    expect(patterns).toContain('#fff');
    expect(patterns).toHaveLength(1);
  });

  it('extracts multiple different pattern types', () => {
    const patterns = extractPatterns('change "$14.99" price and color #21C6FF');
    expect(patterns).toContain('$14.99');
    expect(patterns).toContain('#21C6FF');
    expect(patterns).toHaveLength(2);
  });

  it('returns empty array when no patterns found', () => {
    const patterns = extractPatterns('change the header color');
    expect(patterns).toEqual([]);
  });

  it('returns unique patterns (no duplicates)', () => {
    const patterns = extractPatterns('change "$14" to "$14"');
    expect(patterns).toContain('$14');
    expect(patterns).toHaveLength(1);
  });
});

describe('grepForSpecificText', () => {
  const mockFiles: FileMap = {
    '/home/project/src/data/menu.json': {
      type: 'file',
      content: JSON.stringify({
        items: [
          { name: 'Burger', price: '$14.99' },
          { name: 'Pizza', price: '$16.50' },
        ],
      }),
      isBinary: false,
    },
    '/home/project/src/styles/theme.css': {
      type: 'file',
      content: `.primary { color: #21C6FF; }
.secondary { color: #FF5733; }`,
      isBinary: false,
    },
    '/home/project/src/components/Footer.tsx': {
      type: 'file',
      content: `export const Footer = () => (
  <footer>
    <p>Open 9am-10pm Daily</p>
    <p>Call us: 555-1234</p>
  </footer>
);`,
      isBinary: false,
    },
    '/home/project/src/assets/logo.png': {
      type: 'file',
      content: 'binary content here',
      isBinary: true,
    },
    '/home/project/src/components': {
      type: 'folder',
    },
  };

  it('finds file containing price when query mentions price change', () => {
    const matches = grepForSpecificText('change "$14.99" to "$18.99"', mockFiles);
    expect(matches).toContain('/home/project/src/data/menu.json');
    expect(matches).toHaveLength(1);
  });

  it('finds file containing hex color #21C6FF', () => {
    const matches = grepForSpecificText('update color to #21C6FF', mockFiles);
    expect(matches).toContain('/home/project/src/styles/theme.css');
    expect(matches).toHaveLength(1);
  });

  it('finds file containing quoted string', () => {
    const matches = grepForSpecificText('change "Open 9am-10pm Daily" to "Open 8am-11pm"', mockFiles);
    expect(matches).toContain('/home/project/src/components/Footer.tsx');
    expect(matches).toHaveLength(1);
  });

  it('returns empty array when no patterns found in query', () => {
    const matches = grepForSpecificText('make the header bigger', mockFiles);
    expect(matches).toEqual([]);
  });

  it('returns empty array when pattern not found in any file', () => {
    const matches = grepForSpecificText('find "$999.99" in files', mockFiles);
    expect(matches).toEqual([]);
  });

  it('skips binary files', () => {
    // Even if binary content somehow contained the pattern, it should be skipped
    const matches = grepForSpecificText('search for "binary" content', mockFiles);
    expect(matches).not.toContain('/home/project/src/assets/logo.png');
  });

  it('skips folder entries', () => {
    const matches = grepForSpecificText('find "components" folder', mockFiles);
    expect(matches).not.toContain('/home/project/src/components');
  });

  it('finds multiple files containing the same pattern', () => {
    const filesWithSameContent: FileMap = {
      '/home/project/src/page1.tsx': {
        type: 'file',
        content: 'Price: $14.99',
        isBinary: false,
      },
      '/home/project/src/page2.tsx': {
        type: 'file',
        content: 'Also costs $14.99',
        isBinary: false,
      },
    };
    const matches = grepForSpecificText('update "$14.99"', filesWithSameContent);
    expect(matches).toContain('/home/project/src/page1.tsx');
    expect(matches).toContain('/home/project/src/page2.tsx');
    expect(matches).toHaveLength(2);
  });

  it('returns unique file paths when multiple patterns match same file', () => {
    const matches = grepForSpecificText('change "$14.99" to "$16.50"', mockFiles);

    // Both prices are in menu.json, should only appear once
    expect(matches).toContain('/home/project/src/data/menu.json');
    expect(matches).toHaveLength(1);
  });

  it('handles empty files map', () => {
    const matches = grepForSpecificText('find "$14" please', {});
    expect(matches).toEqual([]);
  });
});
