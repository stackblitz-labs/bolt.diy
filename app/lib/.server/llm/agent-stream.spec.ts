import { isStepCount, jsonSchema, streamText, tool, toUIMessageStream, type ToolSet, type TextStreamPart } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAgentStreamRecovery, withAgentStreamDeadlines } from './agent-stream';
import { toSafeStreamErrorMessage } from '~/lib/.server/api/errors';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, reasoning: 0, text: 1 },
};

const finish = (controller: ReadableStreamDefaultController<any>, toolCalls = false) => {
  controller.enqueue({
    type: 'finish',
    finishReason: { unified: toolCalls ? 'tool-calls' : 'stop', raw: toolCalls ? 'tool_calls' : 'stop' },
    usage,
  });
  controller.close();
};
const collect = async <TOOLS extends ToolSet>(
  result: { stream: ReadableStream<TextStreamPart<TOOLS>> },
  mapError = toSafeStreamErrorMessage,
) => {
  const chunks = [];

  for await (const chunk of toUIMessageStream({ stream: result.stream, onError: mapError })) {
    chunks.push(chunk);
  }

  return chunks;
};
afterEach(() => vi.useRealTimers());

describe('agent provider recovery', () => {
  it('waits beyond 45 seconds and retries only the stalled step, preserving the recorded plan', async () => {
    vi.useFakeTimers();

    const recordPlan = vi.fn(async () => ({ plan: 'recorded' }));

    let call = 0;

    const model = new MockLanguageModelV4({
      doStream: async () => {
        const attempt = call++;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });

              if (attempt === 0) {
                controller.enqueue({ type: 'tool-call', toolCallId: 'plan', toolName: 'agent_plan', input: '{}' });
                finish(controller, true);
              } else if (attempt === 1) {
                controller.enqueue({ type: 'reasoning-start', id: 'thinking' });
                controller.enqueue({
                  type: 'reasoning-delta',
                  id: 'thinking',
                  delta: 'Now let me install dependencies first.',
                });

                // Reproduce the user's provider silence before command/tool output.
              } else {
                controller.enqueue({
                  type: 'tool-call',
                  toolCallId: 'install',
                  toolName: 'project_run_command',
                  input: '{"command":"npm install","purpose":"install"}',
                });
                finish(controller, true);
              }
            },
          }),
        };
      },
    });

    const onRetry = vi.fn();
    const recovery = createAgentStreamRecovery(onRetry);

    const result = await streamText({
      model: withAgentStreamDeadlines(model),
      prompt: 'Build the page.',
      toolChoice: 'required',
      tools: {
        agent_plan: tool({ inputSchema: jsonSchema({ type: 'object', properties: {} }), execute: recordPlan }),
        project_run_command: {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { command: { type: 'string' }, purpose: { type: 'string' } },
            required: ['command', 'purpose'],
          }),
        },
      },
      streamRetries: 0,
      onError: recovery.onError,
      stopWhen: isStepCount(5),
    });

    const collected = collect(result, (error) => toSafeStreamErrorMessage(recovery.getError(error)));
    await vi.advanceTimersByTimeAsync(45_000);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(onRetry).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(75_001);

    const chunks = await collected;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(recordPlan).toHaveBeenCalledTimes(1);
    expect(model.doStreamCalls).toHaveLength(3);
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
    expect(chunks).toContainEqual(
      expect.objectContaining({ type: 'tool-input-available', toolName: 'project_run_command', toolCallId: 'install' }),
    );
    expect(model.doStreamCalls[2].prompt).toEqual(model.doStreamCalls[1].prompt);
  });

  it('buffers incomplete failed tool attempts so effects are executed only once', async () => {
    const execute = vi.fn(async () => ({ written: true }));

    let call = 0;

    const model = new MockLanguageModelV4({
      doStream: async () => {
        const fail = call++ === 0;
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: fail ? 'discarded' : 'kept',
                toolName: 'project_write_file',
                input: '{}',
              });

              if (fail) {
                controller.enqueue({ type: 'error', error: new Error('Network connection lost') });
                controller.close();
              } else {
                finish(controller, true);
              }
            },
          }),
        };
      },
    });

    const recovery = createAgentStreamRecovery(vi.fn());

    const result = await streamText({
      model: withAgentStreamDeadlines(model),
      prompt: 'Edit the page.',
      tools: { project_write_file: tool({ inputSchema: jsonSchema({ type: 'object', properties: {} }), execute }) },
      streamRetries: 0,
      onError: recovery.onError,
    });

    const chunks = await collect(result);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(chunks).not.toContainEqual(expect.objectContaining({ toolCallId: 'discarded' }));
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'tool-output-available', toolCallId: 'kept' }));
  });

  it('stops after one failed recovery and reports the timeout without a misleading tool error', async () => {
    vi.useFakeTimers();

    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
          },
        }),
      }),
    });

    const onRetry = vi.fn();
    const recovery = createAgentStreamRecovery(onRetry);

    const result = await streamText({
      model: withAgentStreamDeadlines(model, { firstMs: 20, idleMs: 20, attemptMs: 100 }),
      prompt: 'Continue.',
      toolChoice: 'required',
      tools: { project_list_paths: { inputSchema: jsonSchema({ type: 'object', properties: {} }) } },
      streamRetries: 0,
      onError: recovery.onError,
    });

    const collected = collect(result, (error) => toSafeStreamErrorMessage(recovery.getError(error)));
    await vi.advanceTimersByTimeAsync(41);

    const chunks = await collected;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(model.doStreamCalls).toHaveLength(2);
    expect(chunks).toContainEqual(
      expect.objectContaining({ type: 'error', errorText: expect.stringContaining('provider stopped responding') }),
    );
    expect(JSON.stringify(chunks)).not.toContain('text instead of the required tool call');
  });

  it('respects cancellation and does not retry authentication or rate-limit errors', () => {
    const onRetry = vi.fn();

    for (const error of [
      new DOMException('Network connection cancelled', 'AbortError'),
      Object.assign(new Error('Unauthorized network request'), { statusCode: 401 }),
      Object.assign(new Error('Network rate limit'), { statusCode: 429 }),
    ]) {
      const recovery = createAgentStreamRecovery(onRetry);
      expect(recovery.onError({ error })).toBeUndefined();
    }
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('aborts a silent initial provider request and retries with a fresh signal', async () => {
    vi.useFakeTimers();

    const signals: AbortSignal[] = [];

    const model = new MockLanguageModelV4({
      doStream: async ({ abortSignal }) => {
        signals.push(abortSignal!);

        if (signals.length === 1) {
          return await new Promise<never>((_, reject) =>
            abortSignal!.addEventListener('abort', () => reject(abortSignal!.reason), { once: true }),
          );
        }

        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({ type: 'text-start', id: 'ok' });
              controller.enqueue({ type: 'text-delta', id: 'ok', delta: 'Recovered.' });
              controller.enqueue({ type: 'text-end', id: 'ok' });
              finish(controller);
            },
          }),
        };
      },
    });

    const onRetry = vi.fn();
    const recovery = createAgentStreamRecovery(onRetry);

    const result = await streamText({
      model: withAgentStreamDeadlines(model, { firstMs: 20, idleMs: 20, attemptMs: 100 }),
      prompt: 'Continue.',
      streamRetries: 0,
      onError: recovery.onError,
    });

    const collected = collect(result);
    await vi.advanceTimersByTimeAsync(21);

    const chunks = await collected;
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(chunks).toContainEqual(expect.objectContaining({ type: 'text-delta', delta: 'Recovered.' }));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not replay an accepted tool call when the transport closes badly after finish', async () => {
    const execute = vi.fn(async () => ({ written: true }));

    const model = new MockLanguageModelV4({
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'tool-call', toolCallId: 'write', toolName: 'project_write_file', input: '{}' });
            controller.enqueue({ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage });
            controller.enqueue({ type: 'error', error: new Error('Network connection failed after completion') });
            controller.close();
          },
        }),
      }),
    });

    const onRetry = vi.fn();
    const recovery = createAgentStreamRecovery(onRetry);

    const result = await streamText({
      model: withAgentStreamDeadlines(model),
      prompt: 'Edit.',
      tools: { project_write_file: tool({ inputSchema: jsonSchema({ type: 'object', properties: {} }), execute }) },
      streamRetries: 0,
      onError: recovery.onError,
    });

    const chunks = await collect(result);
    expect(onRetry).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(chunks.some((chunk) => chunk.type === 'error')).toBe(false);
  });
});
