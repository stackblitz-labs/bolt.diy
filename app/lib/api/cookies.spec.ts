import { describe, it, expect } from 'vitest';
import { safeJsonParse, parseCookies, getApiKeysFromCookie, getProviderSettingsFromCookie } from './cookies';

describe('cookies utilities', () => {
  describe('safeJsonParse', () => {
    it('parses valid JSON string', () => {
      const result = safeJsonParse('{"key":"value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('returns fallback on invalid JSON string', () => {
      const result = safeJsonParse('invalid-json', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it('returns fallback on null, undefined, or empty string', () => {
      expect(safeJsonParse(null, { default: 1 })).toEqual({ default: 1 });
      expect(safeJsonParse(undefined, { default: 2 })).toEqual({ default: 2 });
      expect(safeJsonParse('', { default: 3 })).toEqual({ default: 3 });
    });
  });

  describe('parseCookies', () => {
    it('returns empty object for empty or null header', () => {
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies('')).toEqual({});
    });

    it('parses standard cookies correctly', () => {
      const header = 'theme=dark; sessionId=abc123';
      expect(parseCookies(header)).toEqual({
        theme: 'dark',
        sessionId: 'abc123',
      });
    });

    it('handles URI-encoded cookie values and malformed URI sequences gracefully', () => {
      const header = 'user=%E2%9C%93; malformed=%E0%A4%A; regular=hello';
      const cookies = parseCookies(header);
      expect(cookies.user).toBe('✓');
      expect(cookies.regular).toBe('hello');
      expect(cookies.malformed).toBeDefined();
    });
  });

  describe('getApiKeysFromCookie', () => {
    it('extracts and parses valid apiKeys cookie', () => {
      const header = 'apiKeys=%7B%22OpenAI%22%3A%22sk-test123%22%7D';
      const keys = getApiKeysFromCookie(header);
      expect(keys).toEqual({ OpenAI: 'sk-test123' });
    });

    it('returns empty object if apiKeys cookie is missing or malformed', () => {
      expect(getApiKeysFromCookie(null)).toEqual({});
      expect(getApiKeysFromCookie('apiKeys=corrupted_non_json')).toEqual({});
    });
  });

  describe('getProviderSettingsFromCookie', () => {
    it('extracts and parses valid provider settings', () => {
      const header = 'providers=%7B%22OpenAI%22%3A%7B%22enabled%22%3Atrue%7D%7D';
      const settings = getProviderSettingsFromCookie(header);
      expect(settings).toEqual({ OpenAI: { enabled: true } });
    });

    it('returns empty object if providers cookie is missing or malformed', () => {
      expect(getProviderSettingsFromCookie(null)).toEqual({});
      expect(getProviderSettingsFromCookie('providers=corrupted_non_json')).toEqual({});
    });
  });
});
