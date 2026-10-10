/**
 * Lightweight, dependency-free HTML helpers. These run in Cloudflare Workers,
 * so there is no DOMParser — regex extraction is intentionally "good enough"
 * for turning a page into LLM context, not a general-purpose HTML parser.
 */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const isHex = code[1] === 'x' || code[1] === 'X';
      const codePoint = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);

      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }

    return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Removes tags and collapses whitespace, decoding entities. */
export function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function removeElements(html: string, tags: string[]): string {
  return tags.reduce(
    (result, tag) => result.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' '),
    html,
  );
}

export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
}

export function extractMetaDescription(html: string): string {
  const match =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ??
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);

  return match ? decodeHtmlEntities(match[1]).trim() : '';
}

/**
 * Extracts readable text from a page, preferring `<main>`/`<article>` content
 * and dropping scripts, styles and page chrome.
 */
export function extractTextContent(html: string): string {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, ' ');

  const cleaned = removeElements(withoutComments, [
    'head',
    'title',
    'script',
    'style',
    'noscript',
    'svg',
    'template',
    'iframe',
  ]);

  const main =
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ?? cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);

  const body = main ? main[1] : removeElements(cleaned, ['nav', 'header', 'footer', 'aside', 'form']);

  return stripTags(body);
}

export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}
