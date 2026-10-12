import { describe, expect, it } from 'vitest';
import { PayloadTooLargeError, RequestAbortedError, RequestTimeoutError, ValidationError } from './errors';
import { readBodyText, readJsonBody } from './read-body';

function requestFrom(body: BodyInit | ReadableStream<Uint8Array>, init: RequestInit = {}): Request {
  /* Streams require an explicit duplex mode; string/blob bodies do not. */
  const isStream = typeof body === 'object' && body !== null && 'getReader' in body;

  return new Request('https://example.com/api/chat', {
    method: 'POST',
    ...(isStream ? { duplex: 'half' } : {}),
    ...init,
    body: body as BodyInit,
  } as RequestInit);
}

describe('readBodyText', () => {
  it('reads a body that is within budget', async () => {
    const text = await readBodyText(requestFrom(JSON.stringify({ ok: true })), { maxBytes: 1024 });
    expect(text).toBe('{"ok":true}');
  });

  it('returns an empty string when there is no body', async () => {
    expect(await readBodyText(new Request('https://example.com/api/chat'), { maxBytes: 1024 })).toBe('');
  });

  describe('byte accounting', () => {
    /*
     * The reason this counts bytes rather than characters.
     *
     * `body.length` counts UTF-16 code units. A body of astral-plane characters
     * (emoji: 2 units, 4 bytes) under-reports by half; CJK (1 unit, 3 bytes)
     * under-reports by two thirds. A limit written against `.length` therefore
     * admits bodies several times larger than the one it claims to cap — which
     * is precisely the case the cap exists to prevent.
     */
    it('rejects a multibyte body that fits the character count but not the byte budget', async () => {
      // 3000 emoji = 6000 UTF-16 units, 12000 UTF-8 bytes.
      const oversizedInBytes = '😀'.repeat(3000);

      expect(oversizedInBytes.length).toBe(6000);
      expect(new TextEncoder().encode(oversizedInBytes).byteLength).toBe(12000);

      /*
       * A cap written against `.length` would have compared 6000 <= 8192 and let
       * a 12000-byte body through — 1.5x over budget before any accounting for
       * the fact that the client can repeat the trick.
       */
      await expect(readBodyText(requestFrom(oversizedInBytes), { maxBytes: 8192 })).rejects.toBeInstanceOf(
        PayloadTooLargeError,
      );
    });

    it('would have admitted that body if the cap counted characters', () => {
      /* Pins the premise: the naive check passes where the real one rejects. */
      const body = '😀'.repeat(3000);
      expect(body.length <= 8192).toBe(true);
      expect(new TextEncoder().encode(body).byteLength <= 8192).toBe(false);
    });

    it('accepts the same text when the budget accounts for bytes', async () => {
      const text = '😀'.repeat(1000);

      await expect(readBodyText(requestFrom(text), { maxBytes: 8192 })).resolves.toBe(text);
    });

    it('preserves multibyte characters split across stream chunks', async () => {
      /*
       * A character whose UTF-8 bytes land in two different chunks must not be
       * mangled. `decode(value, { stream: true })` is what makes this work; the
       * final `decode()` flushes any incomplete sequence.
       */
      const encoded = new TextEncoder().encode('héllo — 😀 world');

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          /* Split mid-character: the em dash is 3 bytes. */
          controller.enqueue(encoded.slice(0, 4));
          controller.enqueue(encoded.slice(4, 6));
          controller.enqueue(encoded.slice(6));
          controller.close();
        },
      });

      await expect(readBodyText(requestFrom(stream), { maxBytes: 1024 })).resolves.toBe('héllo — 😀 world');
    });
  });

  describe('oversized bodies', () => {
    it('rejects via the Content-Length fast path without reading the stream', async () => {
      const request = new Request('https://example.com/api/chat', {
        method: 'POST',
        body: 'x'.repeat(100),
        headers: { 'content-length': '999999' },
      });

      await expect(readBodyText(request, { maxBytes: 1024 })).rejects.toBeInstanceOf(PayloadTooLargeError);
    });

    it('does not trust Content-Length when it understates the real size', async () => {
      /*
       * Content-Length is client-supplied. Relying on it alone would make the
       * limit advisory rather than enforced.
       */
      const request = new Request('https://example.com/api/chat', {
        method: 'POST',
        body: 'x'.repeat(5000),
        headers: { 'content-length': '10' },
      });

      await expect(readBodyText(request, { maxBytes: 1024 })).rejects.toBeInstanceOf(PayloadTooLargeError);
    });

    it('stops reading once the budget is exceeded instead of buffering to the end', async () => {
      let cancelled = false;

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          /* Ten 1 KiB chunks: the budget is blown at the second. */
          for (let i = 0; i < 10; i++) {
            controller.enqueue(new Uint8Array(1024));
          }
        },
        cancel() {
          cancelled = true;
        },
      });

      await expect(readBodyText(requestFrom(stream), { maxBytes: 2048 })).rejects.toBeInstanceOf(PayloadTooLargeError);

      expect(cancelled).toBe(true);
    });

    it('names the limit in the error message', async () => {
      const request = requestFrom('x'.repeat(5000), { headers: { 'content-length': '5000' } });

      await expect(readBodyText(request, { maxBytes: 1024 })).rejects.toThrow(/1 KB/);
    });
  });

  describe('stalled and cancelled bodies', () => {
    it('times out a body that stops mid-stream', async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'));

          /* Never closed, never enqueued again. */
        },
      });

      await expect(readBodyText(requestFrom(stream), { maxBytes: 1024, timeoutMs: 20 })).rejects.toBeInstanceOf(
        RequestTimeoutError,
      );
    });

    it('reports a client disconnect as 499 rather than a server error', async () => {
      const controller = new AbortController();
      const request = requestFrom('ignored', { signal: controller.signal });

      const promise = readBodyText(request, { maxBytes: 1024, timeoutMs: 1000 });

      controller.abort();

      await expect(promise).rejects.toBeInstanceOf(RequestAbortedError);
    });
  });
});

describe('readJsonBody', () => {
  it('parses a valid JSON body', async () => {
    const parsed = await readJsonBody<{ value: number }>(requestFrom('{"value":42}'), { maxBytes: 1024 });
    expect(parsed).toEqual({ value: 42 });
  });

  it('reports malformed JSON as a client error, not a 500', async () => {
    await expect(readJsonBody(requestFrom('{"unterminated": '), { maxBytes: 1024 })).rejects.toBeInstanceOf(
      ValidationError,
    );

    const error = await readJsonBody(requestFrom('not json at all'), { maxBytes: 1024 }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).status).toBe(400);
    expect((error as ValidationError).isRetryable).toBe(false);
  });

  it('rejects an empty body', async () => {
    await expect(readJsonBody(requestFrom(''), { maxBytes: 1024 })).rejects.toBeInstanceOf(ValidationError);
  });
});
