import {
  ToolChoiceViolationError,
  wrapLanguageModel,
  type LanguageModel,
  type StreamTextOnErrorRetryCallback,
} from 'ai';

const DEFAULT_ATTEMPT_LIMITS = { firstMs: 120_000, idleMs: 120_000, attemptMs: 300_000 };

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
export function createAgentStreamRecovery(onRetry: () => void) {
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
    onRetry();

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
