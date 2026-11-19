/**
 * Helpers for deploying a build to deed.page (https://deed.page/docs).
 *
 * deed.page needs no account: the first publish returns an owner token, which
 * later publishes send as a Bearer token to update the same site.
 */

export const DEEDPAGE_API_URL = 'https://deed.page';
export const DEEDPAGE_TOKEN_KEY = 'deedpage-token';
export const deedPageSiteKey = (chatId: string) => `deedpage-site-${chatId}`;

/** deed.page rejects JSON bodies above 4 MB. */
export const DEEDPAGE_MAX_BODY_BYTES = 4 * 1000 * 1000;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const TEXT_EXTENSIONS = new Set([
  'html',
  'htm',
  'css',
  'js',
  'mjs',
  'cjs',
  'json',
  'map',
  'txt',
  'md',
  'svg',
  'xml',
  'csv',
  'webmanifest',
  'yml',
  'yaml',
  'toml',
]);

export type DeedPageFile = string | { base64: string };

export function isValidDeedPageSlug(slug: string) {
  return SLUG_RE.test(slug);
}

/** A slug such as `bolt-12-k3j9x2`: unique enough that a first publish does not collide. */
export function deedPageSlugForChat(chatId: string, random = Math.random().toString(36).slice(2, 8)) {
  const base = String(chatId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const suffix = random.toLowerCase().replace(/[^a-z0-9]/g, '') || '0';

  return ['bolt', base, suffix].filter(Boolean).join('-').slice(0, 63).replace(/-+$/, '');
}

function toBase64(bytes: Uint8Array) {
  let binary = '';

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }

  return btoa(binary);
}

/** Text files are sent as strings and everything else as `{ base64 }`, so images and fonts survive. */
export function toDeedPageFiles(entries: Array<{ path: string; bytes: Uint8Array }>) {
  const files: Record<string, DeedPageFile> = {};
  const decoder = new TextDecoder('utf-8', { fatal: true });

  for (const { path, bytes } of entries) {
    const clean = path.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!clean) {
      continue;
    }

    const ext = clean.split('.').pop()?.toLowerCase() ?? '';

    if (TEXT_EXTENSIONS.has(ext)) {
      try {
        files[clean] = decoder.decode(bytes);
        continue;
      } catch {
        // Not valid UTF-8: send the bytes instead.
      }
    }

    files[clean] = { base64: toBase64(bytes) };
  }

  return files;
}

export function deedPageBodySize(slug: string, files: Record<string, DeedPageFile>) {
  return new TextEncoder().encode(JSON.stringify({ slug, files })).length;
}
