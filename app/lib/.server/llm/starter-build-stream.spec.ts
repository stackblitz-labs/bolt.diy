import { streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { createAgentLoopTools } from './agent-loop';
import { toSafeStreamErrorMessage } from '~/lib/.server/api/errors';
import { STARTER_BUILD_FLAG } from '~/lib/common/starterBuild';

describe('starter response stream', () => {
  it('reports a clear failure when a model ignores required tools and returns only a build promise', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 'promise' });
            controller.enqueue({ type: 'text-delta', id: 'promise', delta: "I'll build this out." });
            controller.enqueue({ type: 'text-end', id: 'promise' });
            controller.enqueue({
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
              },
            });
            controller.close();
          },
        }),
      }),
    });
    const loop = createAgentLoopTools(
      [{ role: 'user', content: 'Make a landing page', metadata: { flags: [STARTER_BUILD_FLAG] } }],
      true,
      true,
    );
    const result = await streamText({
      model,
      messages: [{ role: 'user', content: 'Make a landing page' }],
      prepareStep: loop.prepareStep,
      tools: loop.tools,
      onError: vi.fn(),
    });

    const chunks = [];

    for await (const chunk of toUIMessageStream({ stream: result.stream, onError: toSafeStreamErrorMessage })) {
      chunks.push(chunk);
    }
    expect(model.doStreamCalls[0].toolChoice).toEqual({ type: 'tool', toolName: 'agent_plan' });
    expect(model.doStreamCalls[0].tools?.map((tool) => ('name' in tool ? tool.name : ''))).toEqual(['agent_plan']);
    expect(chunks).toContainEqual(
      expect.objectContaining({ type: 'error', errorText: expect.stringContaining('required tool call') }),
    );
  });
});
