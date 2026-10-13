import {
  generateId,
  ToolChoiceViolationError,
  wrapLanguageModel,
  type LanguageModel,
  type StreamTextOnErrorRetryCallback,
} from 'ai';

const DEFAULT_ATTEMPT_LIMITS = { firstMs: 120_000, idleMs: 120_000, attemptMs: 300_000 };

/** Recover complete JSON calls to available tools or retry once. Effects still use normal validation and approvals. */
export function withAgentToolCallRecovery(model: LanguageModel, onRetry: () => void) {
  if (typeof model === 'string') {
    return model;
  }

  const normalized = wrapLanguageModel({ model, middleware: [] });

  return {
    ...normalized,
    doStream: async (params: Parameters<typeof normalized.doStream>[0]) => {
      const choice = params.toolChoice;

      if (!choice || (choice.type !== 'required' && choice.type !== 'tool')) {
        return normalized.doStream(params);
      }

      const cancellation = new AbortController();

      const abortSignal = params.abortSignal
        ? AbortSignal.any([params.abortSignal, cancellation.signal])
        : cancellation.signal;

      const initial = await normalized.doStream({ ...params, abortSignal });
      type Part = Awaited<ReturnType<typeof normalized.doStream>>['stream'] extends ReadableStream<infer T> ? T : never;

      let reader: ReadableStreamDefaultReader<Part> | undefined;
      let cancelled = false;

      return {
        ...initial,
        stream: new ReadableStream<Part>({
          async start(controller) {
            try {
              for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
                const correction =
                  'Your previous response did not call a required tool. Use the supplied native tools interface now. Do not print JSON or function calls as text. Follow the tool schema exactly.';
                const retryPrompt =
                  params.prompt[0]?.role === 'system'
                    ? [
                        { ...params.prompt[0], content: `${params.prompt[0].content}\n\n${correction}` },
                        ...params.prompt.slice(1),
                      ]
                    : [{ role: 'system' as const, content: correction }, ...params.prompt];

                const result =
                  attempt === 0 ? initial : await normalized.doStream({ ...params, prompt: retryPrompt, abortSignal });

                if (cancelled) {
                  await result.stream.cancel();
                  return;
                }

                reader = result.stream.getReader();

                const buffered: Part[] = [];

                let satisfied = false;
                let failed = false;
                let finished = false;

                while (!cancelled) {
                  const { done, value } = await reader.read();

                  if (done) {
                    break;
                  }

                  if (
                    value.type === 'tool-call' &&
                    (choice.type === 'required' || value.toolName === choice.toolName)
                  ) {
                    satisfied = true;
                  }

                  if (satisfied) {
                    for (const part of buffered.splice(0)) {
                      controller.enqueue(part);
                    }
                    controller.enqueue(value);
                  } else {
                    buffered.push(value);
                  }

                  failed ||= value.type === 'error';

                  if (value.type === 'finish') {
                    finished = true;
                    void reader.cancel().catch(() => undefined);
                    break;
                  }
                }

                reader.releaseLock();
                reader = undefined;

                if (cancelled) {
                  return;
                }

                if (finished && !satisfied && !failed) {
                  const text = buffered
                    .filter((part) => part.type === 'text-delta')
                    .map((part) => part.delta)
                    .join('');

                  const calls = recoverJsonToolCalls(text, params.tools, choice);
                  const finish = buffered.find((part) => part.type === 'finish');

                  if (calls.length && finish?.type === 'finish') {
                    for (const part of buffered.filter(
                      (part) => !part.type.startsWith('text-') && part.type !== 'finish',
                    )) {
                      controller.enqueue(part);
                    }

                    for (const call of calls) {
                      controller.enqueue({
                        type: 'tool-call',
                        toolCallId: generateId(),
                        toolName: call.name,
                        input: JSON.stringify(call.input),
                        providerMetadata: { bolt: { recoveredFromText: true } },
                      });
                    }
                    controller.enqueue({
                      ...finish,
                      finishReason: { unified: 'tool-calls', raw: 'recovered-tool-calls' },
                    });
                    controller.close();

                    return;
                  }
                }

                if (attempt === 0 && finished && !satisfied && !failed) {
                  onRetry();
                  continue;
                }

                for (const part of buffered) {
                  controller.enqueue(part);
                }
                controller.close();

                return;
              }
            } catch (error) {
              void reader?.cancel(error).catch(() => undefined);

              if (!cancelled) {
                controller.enqueue({ type: 'error', error });
                controller.close();
              }
            }
          },
          async cancel(reason) {
            cancelled = true;
            cancellation.abort(reason);
            await reader?.cancel(reason);
          },
        }),
      };
    },
  };
}

function recoverJsonToolCalls(
  text: string,
  tools: Parameters<Exclude<LanguageModel, string>['doStream']>[0]['tools'],
  choice: { type: 'required' } | { type: 'tool'; toolName: string },
): Array<{ name: string; input: Record<string, unknown> }> {
  try {
    const trimmed = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*)\n```$/, '$1');

    let parsed: unknown = JSON.parse(trimmed);

    for (
      let depth = 0;
      depth < 2 && Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0]);
      depth++
    ) {
      parsed = parsed[0];
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    const available = new Set(tools?.filter((tool) => tool.type === 'function').map((tool) => tool.name));

    if (!candidates.length || candidates.length > 8) {
      return [];
    }

    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        return [];
      }

      const entry = candidate as Record<string, unknown>;
      const name = entry.name;
      const input = entry.parameters;

      if (
        typeof name !== 'string' ||
        !available.has(name) ||
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(entry).some((key) => key !== 'name' && key !== 'parameters')
      ) {
        return [];
      }

      calls.push({ name, input: input as Record<string, unknown> });
    }

    return choice.type === 'required' || calls.some((call) => call.name === choice.toolName) ? calls : [];
  } catch {
    return [];
  }
}

/** Each model attempt has its own deadline, so a timeout can be retried with a fresh signal. */
export function withAgentStreamDeadlines(model: LanguageModel, limits = DEFAULT_ATTEMPT_LIMITS) {
  if (typeof model === 'string') {
    return model;
  }

  const normalized = wrapLanguageModel({ model, middleware: [] });

  return {
    ...normalized,
    doStream: async (params: Parameters<typeof normalized.doStream>[0]) => {
      const attempt = new AbortController();
      const signal = params.abortSignal ? AbortSignal.any([params.abortSignal, attempt.signal]) : attempt.signal;
      const timeout = () => attempt.abort(new DOMException('Agent model response timed out.', 'TimeoutError'));

      let idleTimer = setTimeout(timeout, limits.firstMs);

      const attemptTimer = setTimeout(timeout, limits.attemptMs);

      const cleanup = () => {
        clearTimeout(idleTimer);
        clearTimeout(attemptTimer);
      };

      let abortHandler: () => void = () => undefined;

      const aborted = new Promise<never>((_, reject) => {
        abortHandler = () => reject(signal.reason);

        if (signal.aborted) {
          abortHandler();
        } else {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      });
      const release = () => {
        cleanup();
        signal.removeEventListener('abort', abortHandler);
      };

      try {
        const result = await Promise.race([normalized.doStream({ ...params, abortSignal: signal }), aborted]);
        const reader = result.stream.getReader();

        let finished = false;

        return {
          ...result,
          stream: new ReadableStream<
            Awaited<ReturnType<typeof normalized.doStream>>['stream'] extends ReadableStream<infer T> ? T : never
          >({
            async pull(controller) {
              if (finished) {
                return;
              }

              try {
                const { done, value } = await Promise.race([reader.read(), aborted]);

                if (done) {
                  finished = true;
                  release();
                  reader.releaseLock();
                  controller.close();

                  return;
                }

                // A completed attempt must not be replayed because its transport fails afterward.
                if (value.type === 'finish') {
                  finished = true;
                  release();
                  controller.enqueue(value);
                  controller.close();
                  void reader.cancel().catch(() => undefined);

                  return;
                }

                if (
                  ['text-delta', 'reasoning-delta', 'tool-input-start', 'tool-input-delta', 'tool-call'].includes(
                    value.type,
                  )
                ) {
                  clearTimeout(idleTimer);
                  idleTimer = setTimeout(timeout, limits.idleMs);
                }

                controller.enqueue(value);
              } catch (error) {
                finished = true;
                release();
                void reader.cancel(error).catch(() => undefined);
                controller.enqueue({ type: 'error', error });
                controller.close();
              }
            },
            async cancel(reason) {
              finished = true;
              attempt.abort(reason);
              release();
              await reader.cancel(reason);
            },
          }),
        };
      } catch (error) {
        release();
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'error' as const, error });
              controller.close();
            },
          }),
        };
      }
    },
  };
}

/** The SDK buffers tool inputs until an attempt succeeds, preserving earlier steps on retry. */
export function createAgentStreamRecovery(onRetry: (reason: 'tool-call' | 'provider') => void) {
  let retried = false;
  let firstError: unknown;

  const onError: StreamTextOnErrorRetryCallback = ({ error }) => {
    firstError ??= error;

    if (retried || ToolChoiceViolationError.isInstance(error)) {
      return undefined;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;

    if (
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof status === 'number' && status >= 400 && status < 500)
    ) {
      return undefined;
    }

    const retryable =
      (error instanceof Error && error.name === 'TimeoutError') ||
      /network|fetch failed|connection|timed?\s*out|timeout/.test(message) ||
      (typeof status === 'number' && status >= 500);

    if (!retryable) {
      return undefined;
    }

    retried = true;
    onRetry('provider');

    return { retry: true };
  };

  return {
    onError,
    getError: (error: unknown) => firstError ?? error,
    stepSucceeded: () => {
      firstError = undefined;
    },
  };
}
