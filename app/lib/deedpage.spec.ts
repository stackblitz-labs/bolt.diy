import { describe, expect, it } from 'vitest';
import { deedPageBodySize, deedPageSlugForChat, isValidDeedPageSlug, toDeedPageFiles } from './deedpage';

describe('deedPageSlugForChat', () => {
  it('builds a valid slug from a chat id', () => {
    const slug = deedPageSlugForChat('12', 'k3j9x2');

    expect(slug).toBe('bolt-12-k3j9x2');
    expect(isValidDeedPageSlug(slug)).toBe(true);
  });

  it('keeps odd chat ids within the slug rules', () => {
    const slug = deedPageSlugForChat('Chat_With Spaces!!'.repeat(10), 'ABC');

    expect(slug.length).toBeLessThanOrEqual(63);
    expect(isValidDeedPageSlug(slug)).toBe(true);
  });
});

describe('toDeedPageFiles', () => {
  const encode = (text: string) => new TextEncoder().encode(text);

  it('sends text as strings and binary files as base64', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

    const files = toDeedPageFiles([
      { path: '/index.html', bytes: encode('<h1>hi</h1>') },
      { path: 'assets/app.js', bytes: encode('console.log(1)') },
      { path: 'assets\\logo.png', bytes: png },
    ]);

    expect(files).toEqual({
      'index.html': '<h1>hi</h1>',
      'assets/app.js': 'console.log(1)',
      'assets/logo.png': { base64: btoa(String.fromCharCode(...png)) },
    });
  });

  it('falls back to base64 for text extensions that are not UTF-8', () => {
    const files = toDeedPageFiles([{ path: 'data.txt', bytes: new Uint8Array([0xff, 0xfe, 0x00]) }]);

    expect(files['data.txt']).toEqual({ base64: '//4A' });
  });

  it('measures the JSON body', () => {
    expect(deedPageBodySize('a', { 'index.html': 'x' })).toBe(
      JSON.stringify({ slug: 'a', files: { 'index.html': 'x' } }).length,
    );
  });
});
