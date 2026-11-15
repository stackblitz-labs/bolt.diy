import { describe, it, expect } from 'vitest';
import { checkRateLimit, createSecurityHeaders, withSecurity } from './security';

describe('security middleware', () => {
  describe('checkRateLimit', () => {
    it('allows requests within the limit', () => {
      const request = new Request('https://example.com/api/test', {
        headers: { 'x-real-ip': '192.168.1.1' },
      });

      const result = checkRateLimit(request, '/api/test', { clientAddress: '192.168.1.1' });
      expect(result.allowed).toBe(true);
    });

    it('matches exact endpoints before wildcard rules', () => {
      const ip = '10.0.0.1';

      const chatRequest = new Request('https://example.com/api/chat', {
        headers: { 'x-real-ip': ip },
      });

      // The first request to /api/chat should be allowed
      const result = checkRateLimit(chatRequest, '/api/chat', { clientAddress: ip });
      expect(result.allowed).toBe(true);
    });

    it('blocks requests once rate limit is exceeded', () => {
      const ip = '10.0.0.99';

      const request = new Request('https://example.com/api/llmcall', {
        headers: { 'x-real-ip': ip },
      });

      // /api/llmcall has a limit of 30
      for (let i = 0; i < 30; i++) {
        const res = checkRateLimit(request, '/api/llmcall', { clientAddress: ip });
        expect(res.allowed).toBe(true);
      }

      // 31st request should be blocked
      const blocked = checkRateLimit(request, '/api/llmcall', { clientAddress: ip });
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetTime).toBeGreaterThan(Date.now());
    });

    it('does not use caller-supplied forwarding headers as a trusted identity', () => {
      const request = new Request('https://example.com/api/chat', {
        headers: { 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9' },
      });

      expect(checkRateLimit(request, '/api/chat')).toEqual({ allowed: false, unavailable: true });
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

  describe('withSecurity error handling', () => {
    const context = { clientAddress: '10.0.0.1' };

    function invoke(handler: Parameters<typeof withSecurity>[0]) {
      return withSecurity(handler, { allowedMethods: ['POST'] })({
        request: new Request('https://example.com/api/thing', { method: 'POST' }),
        context,
        params: {},
      } as never);
    }

    it('preserves the status of a Response the route threw', async () => {
      /*
       * `throw new Response(..., { status: 400 })` is React Router's idiom for
       * stopping with a specific response. The wrapper used to catch it and
       * return 500, so every deliberate 400 in the routes became an opaque
       * server error in the UI.
       */
      const response = await invoke(() => {
        throw new Response('Invalid or missing model', { status: 400, statusText: 'Bad Request' });
      });

      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toBe('Invalid or missing model');
    });

    it('preserves the status of a typed ApiError and its body', async () => {
      const response = await invoke(() => {
        throw Object.assign(new Error('Invalid chat request.'), {
          name: 'ApiError',
          status: 400,
          body: {
            error: true,
            message: 'Invalid chat request.',
            statusCode: 400,
            isRetryable: false,
            provider: 'OpenAI',
          },
        });
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ statusCode: 400, isRetryable: false, provider: 'OpenAI' });
    });

    it('recognises an ApiError subclass, which renames itself', async () => {
      /*
       * Regression: identifying typed errors by `name === 'ApiError'` rejects
       * every subclass, because each sets its own name. That silently turned the
       * precise statuses (413 too large, 408 timeout, 499 cancelled) back into
       * 500s — the exact outcome this change exists to prevent.
       */
      const response = await invoke(() => {
        throw Object.assign(new Error('Request body is too large.'), {
          name: 'PayloadTooLargeError',
          status: 413,
          code: 'payload_too_large',
          isRetryable: false,
          body: {
            error: true,
            message: 'Request body is too large.',
            statusCode: 413,
            isRetryable: false,
            provider: 'unknown',
          },
        });
      });

      expect(response.status).toBe(413);
      expect(await response.json()).toMatchObject({ statusCode: 413 });
    });

    it('passes through a client-cancelled request as 499, not a server fault', async () => {
      const response = await invoke(() => {
        throw Object.assign(new Error('Request cancelled.'), {
          name: 'RequestAbortedError',
          status: 499,
          body: {
            error: true,
            message: 'Request cancelled.',
            statusCode: 499,
            isRetryable: false,
            provider: 'unknown',
          },
        });
      });

      expect(response.status).toBe(499);
    });

    it('still returns 500 for an unexpected error', async () => {
      const response = await invoke(() => {
        throw new Error('something broke deep in a provider SDK');
      });

      expect(response.status).toBe(500);
    });

    it('does not leak an unexpected error message to the client in production', async () => {
      const response = await invoke(() => {
        throw new Error('failed to fetch https://api.example.com/v1?key=sk-secret');
      });

      const body = (await response.json()) as { message: string };

      expect(body.message).not.toContain('sk-secret');
    });

    it('adds security headers to a passed-through thrown Response', async () => {
      const response = await invoke(() => {
        throw new Response('nope', { status: 403 });
      });

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('passes the thrown Response body through verbatim', async () => {
      /*
       * A Response also has a numeric `status` and an object `body`, so it
       * matches the ApiError shape test. Checking the ApiError branch first
       * JSON.stringify'd the stream and returned `{}` — the route's message
       * vanished. Pins the branch order.
       */
      const response = await invoke(() => {
        throw Response.json({ detail: 'keep me' }, { status: 422 });
      });

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ detail: 'keep me' });
    });

    it('adds security headers to a successful response', async () => {
      const response = await invoke(async () => new Response('ok', { status: 200 }));

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });
});
