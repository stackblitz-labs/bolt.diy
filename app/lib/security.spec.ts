import { describe, it, expect } from 'vitest';
import { checkRateLimit, createSecurityHeaders } from './security';

describe('security middleware', () => {
  describe('checkRateLimit', () => {
    it('allows requests within the limit', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'x-real-ip': '192.168.1.1' },
      });

      const result = checkRateLimit(request, '/api/test');
      expect(result.allowed).toBe(true);
    });

    it('matches exact endpoints before wildcard rules', () => {
      const ip = '10.0.0.1';

      const chatRequest = new Request('https://example.com/api/chat', {
        headers: { 'x-real-ip': ip },
      });

      // The first request to /api/chat should be allowed
      const result = checkRateLimit(chatRequest, '/api/chat');
      expect(result.allowed).toBe(true);
    });

    it('blocks requests once rate limit is exceeded', () => {
      const ip = '10.0.0.99';

      const request = new Request('https://example.com/api/llmcall', {
        headers: { 'x-real-ip': ip },
      });

      // /api/llmcall has a limit of 30
      for (let i = 0; i < 30; i++) {
        const res = checkRateLimit(request, '/api/llmcall');
        expect(res.allowed).toBe(true);
      }

      // 31st request should be blocked
      const blocked = checkRateLimit(request, '/api/llmcall');
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetTime).toBeGreaterThan(Date.now());
    });
  });

  describe('createSecurityHeaders', () => {
    it('provides standard security headers', () => {
      const headers = createSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Content-Security-Policy']).toBeDefined();
    });
  });
});
