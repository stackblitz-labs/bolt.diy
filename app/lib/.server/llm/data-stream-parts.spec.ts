import { describe, expect, it } from 'vitest';
import {
  createReasoningRewriteTransform,
  rewriteReasoningParts,
  THOUGHT_CLOSE_PART,
  THOUGHT_OPEN_PART,
} from './data-stream-parts';

/*
 * The AI SDK ships model reasoning on a dedicated data-stream channel (parts
 * prefixed with `g:`). Bolt rewrites those into ordinary text parts wrapped in
 * a `__boltThought__` div so the markdown pipeline renders a ThoughtBox.
 *
 * These tests pin that rewrite byte-for-byte: it is the only place in the app
 * that knows the AI SDK's wire format, and the `__boltThought__` wrapper is
 * load-bearing in Markdown.tsx, utils/markdown.ts and stream-text.ts.
 */

function run(chunks: unknown[], initial?: string) {
  const emitted: string[] = [];

  let lastChunk = initial;

  for (const chunk of chunks) {
    const result = rewriteReasoningParts(chunk, lastChunk);
    lastChunk = result.lastChunk as string | undefined;
    emitted.push(...result.parts);
  }

  return emitted;
}

describe('rewriteReasoningParts', () => {
  it('passes ordinary text parts through untouched', () => {
    expect(run(['0:"hi"\n'])).toEqual(['0:"hi"\n']);
  });

  it('passes non-reasoning parts through untouched', () => {
    expect(run(['f:{"messageId":"m1"}\n', 'd:{"finishReason":"stop"}\n'])).toEqual([
      'f:{"messageId":"m1"}\n',
      'd:{"finishReason":"stop"}\n',
    ]);
  });

  it('wraps a reasoning delta in an opening thought div', () => {
    expect(run(['g:"I think"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"I think"\n']);
  });

  it('opens the thought div only once across consecutive reasoning deltas', () => {
    expect(run(['g:"a"\n', 'g:"b"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"a"\n', '0:"b"\n']);
  });

  it('closes the thought div when reasoning stops', () => {
    expect(run(['g:"a"\n', '0:"b"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"a"\n', THOUGHT_CLOSE_PART, '0:"b"\n']);
  });

  it('opens a new thought div when reasoning resumes', () => {
    expect(run(['g:"a"\n', '0:"b"\n', 'g:"c"\n'])).toEqual([
      THOUGHT_OPEN_PART,
      '0:"a"\n',
      THOUGHT_CLOSE_PART,
      '0:"b"\n',
      THOUGHT_OPEN_PART,
      '0:"c"\n',
    ]);
  });

  it('preserves colons inside the reasoning payload', () => {
    expect(run(['g:"{\\"a\\":1}"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"{\\"a\\":1}"\n']);
  });

  it('appends a trailing newline when the SDK omits one', () => {
    expect(run(['g:"no-newline"'])).toEqual([THOUGHT_OPEN_PART, '0:"no-newline"\n']);
  });

  it('only strips a newline that is the very last character', () => {
    expect(run(['g:"x\n\n"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"x\n\n"\n']);
    expect(run(['g:x\n\n'])).toEqual([THOUGHT_OPEN_PART, '0:x\n\n']);
  });

  it('handles an empty reasoning delta', () => {
    expect(run(['g:\n'])).toEqual([THOUGHT_OPEN_PART, '0:\n']);
  });

  it('JSON-stringifies non-string chunks instead of dropping them', () => {
    const emitted = run([new Uint8Array([104, 105])], '0:"seed"\n');

    expect(emitted).toHaveLength(1);
    expect(JSON.parse(emitted[0])).toEqual({ 0: 104, 1: 105 });
  });

  it('treats the first chunk as non-reasoning when no previous chunk exists', () => {
    expect(run(['2:[{"type":"progress"}]\n'])).toEqual(['2:[{"type":"progress"}]\n']);
  });

  it('keeps state isolated between calls (no thought wrapper bleed)', () => {
    expect(run(['g:"a"\n'])).toEqual([THOUGHT_OPEN_PART, '0:"a"\n']);
    expect(run(['0:"b"\n'])).toEqual(['0:"b"\n']);
  });

  it('accepts an explicit previous chunk so callers can resume mid-stream', () => {
    expect(run(['0:"b"\n'], 'g:"a"\n')).toEqual([THOUGHT_CLOSE_PART, '0:"b"\n']);
  });
});

describe('createReasoningRewriteTransform', () => {
  async function pipe(chunks: string[]) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const source = new ReadableStream<string>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }

        controller.close();
      },
    });

    const output = source.pipeThrough(createReasoningRewriteTransform());
    const reader = output.getReader();
    const parts: string[] = [];

    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      parts.push(decoder.decode(value));
    }

    expect(encoder).toBeInstanceOf(TextEncoder);

    return parts;
  }

  it('rewrites a mixed reasoning/text stream end to end', async () => {
    const parts = await pipe(['0:"start"\n', 'g:"thinking"\n', '0:"answer"\n']);

    expect(parts).toEqual(['0:"start"\n', THOUGHT_OPEN_PART, '0:"thinking"\n', THOUGHT_CLOSE_PART, '0:"answer"\n']);
  });

  it('emits byte chunks that concatenate back into the rewritten protocol', async () => {
    const parts = await pipe(['g:"only reasoning"\n']);

    expect(parts.join('')).toBe(`${THOUGHT_OPEN_PART}0:"only reasoning"\n`);
  });

  it('does not leak thought state across two concurrent transforms', async () => {
    const [a, b] = await Promise.all([pipe(['g:"a"\n']), pipe(['g:"b"\n'])]);

    expect(a).toEqual([THOUGHT_OPEN_PART, '0:"a"\n']);
    expect(b).toEqual([THOUGHT_OPEN_PART, '0:"b"\n']);
  });
});
