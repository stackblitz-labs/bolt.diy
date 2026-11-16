import DOMPurify from 'dompurify';

const MARKUP_TAGS = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'i',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const MARKUP_ATTRIBUTES = ['class', 'href', 'rel', 'style', 'target', 'title'];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeHtml(dirty: string): string {
  if (!DOMPurify.isSupported) {
    return escapeHtml(dirty);
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: MARKUP_TAGS,
    ALLOWED_ATTR: MARKUP_ATTRIBUTES,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['embed', 'iframe', 'math', 'object', 'script', 'style', 'svg'],
    FORBID_ATTR: ['srcdoc'],
  });
}

export function sanitizeCodeHtml(dirty: string): string {
  if (!DOMPurify.isSupported) {
    return escapeHtml(dirty);
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['code', 'pre', 'span'],
    ALLOWED_ATTR: ['class', 'style'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['embed', 'iframe', 'math', 'object', 'script', 'style', 'svg'],
  });
}
