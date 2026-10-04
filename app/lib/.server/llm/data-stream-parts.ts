/*
 * Wire-level helpers for the AI SDK data stream.
 *
 * Bolt renders model reasoning as a `ThoughtBox`, but the AI SDK ships reasoning
 * on its own channel (parts prefixed with `g:`). These helpers rewrite reasoning
 * parts into ordinary text parts wrapped in a `__boltThought__` div so the
 * existing markdown/parser pipeline can render them like any other text.
 *
 * NOTE: this module encodes AI SDK v4 data-stream protocol details (the `g:`
 * reasoning prefix and the `0:` text prefix). It is deliberately isolated here
 * so the coupling is visible and unit-testable instead of buried in a route.
 */

export const THOUGHT_OPEN_PART = `0: "<div class=\\"__boltThought__\\">"\n`;
export const THOUGHT_CLOSE_PART = `0: "</div>\\n"\n`;

const REASONING_PREFIX = 'g';
const TEXT_PREFIX = '0';

/**
 * Rewrites a single data-stream chunk, returning every line that should be
 * written downstream. Exposed separately from the TransformStream so it can be
 * tested without streams; the caller is responsible for threading `lastChunk`.
 */
export function rewriteReasoningParts(
  chunk: unknown,
  lastChunk: string | undefined,
): { parts: string[]; lastChunk: unknown } {
  const parts: string[] = [];

  let previous = lastChunk;

  if (previous === undefined) {
    previous = ' ';
  }

  if (typeof chunk === 'string') {
    if (chunk.startsWith(REASONING_PREFIX) && !String(previous).startsWith(REASONING_PREFIX)) {
      parts.push(THOUGHT_OPEN_PART);
    }

    if (String(previous).startsWith(REASONING_PREFIX) && !chunk.startsWith(REASONING_PREFIX)) {
      parts.push(THOUGHT_CLOSE_PART);
    }
  }

  let transformedChunk = chunk;

  if (typeof chunk === 'string' && chunk.startsWith(REASONING_PREFIX)) {
    let content = chunk.split(':').slice(1).join(':');

    if (content.endsWith('\n')) {
      content = content.slice(0, content.length - 1);
    }

    transformedChunk = `${TEXT_PREFIX}:${content}\n`;
  }

  parts.push(typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk));

  return { parts, lastChunk: chunk };
}

/**
 * TransformStream that applies {@link rewriteReasoningParts} to a string data
 * stream. State is per-instance so concurrent requests cannot leak thought
 * wrappers into one another.
 */
export function createReasoningRewriteTransform(): TransformStream<string, Uint8Array> {
  const encoder = new TextEncoder();

  let lastChunk: string | undefined = undefined;

  return new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      const result = rewriteReasoningParts(chunk, lastChunk);
      lastChunk = result.lastChunk as string | undefined;

      for (const part of result.parts) {
        controller.enqueue(encoder.encode(part));
      }
    },
  });
}
