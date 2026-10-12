import type { UIMessage } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createChatUIMessageStream } from './chat-stream';

describe('chat connector continuation stream', () => {
  it('keeps approved dynamic tool results and the following response in the same message', async () => {
    const onEnd = vi.fn();

    const messages: UIMessage[] = [
      { id: 'user', role: 'user', parts: [{ type: 'text', text: 'Find food near 26003' }] },
      {
        id: 'assistant',
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: 'run_session',
            toolCallId: 'browser-call',
            state: 'output-available',
            input: { task: 'Find food near 26003' },
            output: 'Yes, approved.',
          },
        ],
      },
    ];

    const output = { session_id: 'browser-session', status: 'running' };

    const stream = createChatUIMessageStream(messages, {
      async execute({ writer }) {
        await Promise.resolve();
        writer.write({ type: 'tool-output-available', toolCallId: 'browser-call', output });
        writer.write({ type: 'text-start', id: 'text' });
        writer.write({ type: 'text-delta', id: 'text', delta: 'Checking the browser results.' });
        writer.write({ type: 'text-end', id: 'text' });
        writer.write({ type: 'finish', finishReason: 'stop' });
      },
      onEnd,
    });

    const chunks = [];

    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks[0]).toEqual({ type: 'start', messageId: 'assistant' });
    expect(chunks).toContainEqual({ type: 'tool-output-available', toolCallId: 'browser-call', output });
    expect(chunks.at(-1)).toEqual({ type: 'finish', finishReason: 'stop' });
    expect(onEnd).toHaveBeenCalledWith(
      expect.objectContaining({
        isContinuation: true,
        responseMessage: expect.objectContaining({
          id: 'assistant',
          parts: expect.arrayContaining([
            expect.objectContaining({ type: 'dynamic-tool', output }),
            { type: 'text', text: 'Checking the browser results.', state: 'done', providerMetadata: undefined },
          ]),
        }),
      }),
    );
  });
});
