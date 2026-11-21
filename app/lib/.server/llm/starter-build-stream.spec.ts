import { streamText, toUIMessageStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import { createAgentLoopTools } from './agent-loop';
import { toSafeStreamErrorMessage } from '~/lib/.server/api/errors';
import { STARTER_BUILD_FLAG } from '~/lib/common/starterBuild';
import { projectToolDefinitions } from '~/lib/runtime/projectMcp.shared';

describe('starter response stream', () => {
  it.each([
    { label: 'lists files before planning', listFiles: true },
    { label: 'reports a clear failure for a build promise without a tool call', listFiles: false },
  ])('$label', async ({ listFiles }) => {
    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });

            if (listFiles) {
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'list',
                toolName: 'project_list_paths',
                input: '{}',
              });
            } else {
              controller.enqueue({ type: 'text-start', id: 'promise' });
              controller.enqueue({ type: 'text-delta', id: 'promise', delta: "I'll build this out." });
              controller.enqueue({ type: 'text-end', id: 'promise' });
            }

            controller.enqueue({
              type: 'finish',
              finishReason: listFiles ? { unified: 'tool-calls', raw: 'tool_calls' } : { unified: 'stop', raw: 'stop' },
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
      ['project_list_paths', 'project_read_file', 'project_write_file'],
    );
    const result = await streamText({
      model,
      messages: [{ role: 'user', content: 'Make a landing page' }],
      prepareStep: loop.prepareStep,
      tools: {
        ...loop.tools,
        project_list_paths: projectToolDefinitions.project_list_paths,
        project_read_file: projectToolDefinitions.project_read_file,
        project_write_file: projectToolDefinitions.project_write_file,
      },
      onError: vi.fn(),
    });

    const chunks = [];

    for await (const chunk of toUIMessageStream({ stream: result.stream, onError: toSafeStreamErrorMessage })) {
      chunks.push(chunk);
    }
    expect(model.doStreamCalls[0].toolChoice).toEqual({ type: 'required' });
    expect(model.doStreamCalls[0].tools?.map((tool) => ('name' in tool ? tool.name : '')).sort()).toEqual([
      'agent_plan',
      'project_list_paths',
      'project_read_file',
    ]);

    if (listFiles) {
      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'tool-input-available', toolCallId: 'list', toolName: 'project_list_paths' }),
      );
      expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
    } else {
      expect(chunks).toContainEqual(
        expect.objectContaining({ type: 'error', errorText: expect.stringContaining('required tool call') }),
      );
    }
  });
});
