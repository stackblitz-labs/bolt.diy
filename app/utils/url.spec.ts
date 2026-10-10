import { describe, expect, it } from 'vitest';
import { isAllowedUrl, isValidUrl } from './url';

describe('isValidUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com/path?q=1')).toBe(true);
  });

  it('rejects other protocols and garbage', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('file:///etc/passwd')).toBe(false);
    expect(isValidUrl('react hooks tutorial')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('isAllowedUrl', () => {
  it('allows public hosts', () => {
    expect(isAllowedUrl('https://example.com')).toBe(true);
    expect(isAllowedUrl('https://8.8.8.8/')).toBe(true);
    expect(isAllowedUrl('https://172.32.0.1/')).toBe(true);
    expect(isAllowedUrl('https://[2606:4700:4700::1111]/')).toBe(true);
  });

  it.each([
    'http://localhost:3000',
    'http://LOCALHOST',
    'http://localhost./',
    'http://app.localhost/',
    'http://127.0.0.1/',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://0.0.0.0/',
    'http://10.0.0.5/',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://224.0.0.1/',
    'http://[::1]/',
    'http://[::]/',
    'http://[fc00::1]/',
    'http://[fd12:3456::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:169.254.169.254]/',
  ])('blocks private or local address %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false);
  });

  it('blocks URLs with embedded credentials', () => {
    expect(isAllowedUrl('https://user:pass@example.com/')).toBe(false);
  });

  it('blocks non-http protocols', () => {
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false);
  });
});
