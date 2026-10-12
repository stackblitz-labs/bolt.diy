import { PayloadTooLargeError, RequestAbortedError, RequestTimeoutError, ValidationError } from './errors';

/**
 * Reads a request body under a byte budget, with a deadline and cancellation.
 *
 * Two things this deliberately does differently from the obvious implementation:
 *
 * 1. **Bytes, not characters.** `body.length` counts UTF-16 code units, so a
 *    body of astral-plane characters (emoji, which are 2 units and 4 bytes)
 *    under-reports by half, and a body of CJK text under-reports by ~2/3.
 *    A "too large" check built on it lets an oversized body through, which is
 *    the one case the check exists to stop. The count here is `value.byteLength`
 *    off the raw stream, before any decoding.
 *
 * 2. **Bounded before parsing, and without waiting for the whole body.** The cap
 *    is applied as chunks arrive, so an oversized or stalled upload is refused
 *    early and the connection is cancelled rather than being buffered to
 *    completion first. A `Content-Length` header is used as a fast path but is
 *    never trusted — it is absent on chunked requests and can be a lie.
 */
export async function readBodyText(
  request: Request,
  options: { maxBytes: number; timeoutMs?: number } = { maxBytes: 1024 * 1024 },
): Promise<string> {
  const { maxBytes, timeoutMs = 15_000 } = options;

  /*
   * Fast path only. The header is advisory: chunked requests omit it, and a
   * client can send any value it likes. The streaming check below is the one
   * that actually bounds the work.
   */
  const declaredLength = Number(request.headers.get('content-length'));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }

  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();

  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, timeoutMs);

  request.signal.addEventListener('abort', cancel, { once: true });

  let body = '';
  let bytes = 0;

  try {
    for (;;) {
      if (request.signal.aborted) {
        throw new RequestAbortedError();
      }

      const { done, value } = await reader.read();

      if (timedOut) {
        throw new RequestTimeoutError(timeoutMs);
      }

      if (request.signal.aborted) {
        throw new RequestAbortedError();
      }

      if (done) {
        break;
      }

      bytes += value.byteLength;

      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new PayloadTooLargeError(maxBytes);
      }

      /* `stream: true` so a multi-byte character split across chunks is not mangled. */
      body += decoder.decode(value, { stream: true });
    }

    body += decoder.decode();
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }

  return body;
}

/**
 * Reads and parses a JSON body under a byte budget.
 *
 * Malformed JSON is a client error, so it becomes a 400 rather than the 500 that
 * `request.json()` produces. Nothing downstream should be able to observe a
 * half-parsed body.
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  options: { maxBytes: number; timeoutMs?: number } = { maxBytes: 1024 * 1024 },
): Promise<T> {
  const text = await readBodyText(request, options);

  if (text.trim() === '') {
    throw new ValidationError('Request body must be a JSON object.');
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ValidationError('Request body must be valid JSON.', [
      error instanceof Error ? error.message : 'unparseable',
    ]);
  }
}
