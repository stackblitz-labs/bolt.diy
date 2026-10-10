import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities, extractMetaDescription, extractTextContent, extractTitle, truncate } from './html';

describe('decodeHtmlEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeHtmlEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#x27;f&#x27; &nbsp;')).toBe(
      `a & b <c> "d" 'e' 'f'  `,
    );
  });

  it('leaves unknown or invalid entities alone', () => {
    expect(decodeHtmlEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });
});

describe('extractTitle', () => {
  it('reads and cleans the title', () => {
    expect(extractTitle('<html><head><title>\n  Hello &amp; welcome </title></head></html>')).toBe('Hello & welcome');
  });

  it('returns empty string when missing', () => {
    expect(extractTitle('<html></html>')).toBe('');
  });
});

describe('extractMetaDescription', () => {
  it('handles both attribute orders', () => {
    expect(extractMetaDescription('<meta name="description" content="First">')).toBe('First');
    expect(extractMetaDescription("<meta content='Second' name='description'>")).toBe('Second');
  });
});

describe('extractTextContent', () => {
  it('drops scripts, styles, comments and page chrome', () => {
    const html = `
      <html><body>
        <nav>Menu</nav><header>Header</header>
        <script>var secret = 1;</script><style>.a{}</style><!-- comment -->
        <p>Hello <b>world</b></p>
        <footer>Footer</footer>
      </body></html>`;

    expect(extractTextContent(html)).toBe('Hello world');
  });

  it('prefers <main> content when present', () => {
    const html = '<body><div>Sidebar</div><main><h1>Title</h1><p>Body text</p></main></body>';
    expect(extractTextContent(html)).toBe('Title Body text');
  });
});

describe('truncate', () => {
  it('only truncates long text', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a long sentence', 6)).toBe('a long...');
  });
});
