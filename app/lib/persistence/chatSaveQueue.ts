const STREAM_CHECKPOINT_INTERVAL_MS = 750;

type Save = () => Promise<void>;

interface Checkpoint {
  save: Save;
  resolve: () => void;
  reject: (error: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** Serialize saves and keep only the latest pending checkpoint during a stream. */
export function createChatSaveQueue() {
  let queue = Promise.resolve();
  let pending: Checkpoint | undefined;
  let lastCheckpointAt = -Infinity;

  function enqueue(save: Save) {
    const result = queue.then(save);
    queue = result.catch(() => undefined);

    return result;
  }

  function discardCheckpoint() {
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve();
      pending = undefined;
    }

    lastCheckpointAt = -Infinity;
  }

  function submit(save: Save, isStreaming: boolean) {
    if (!isStreaming) {
      discardCheckpoint();

      return enqueue(save);
    }

    return new Promise<void>((resolve, reject) => {
      if (pending) {
        // The newer sample replaces this checkpoint at the same place in the queue.
        pending.resolve();
        Object.assign(pending, { save, resolve, reject });

        return;
      }

      const checkpoint: Checkpoint = { save, resolve, reject };
      pending = checkpoint;

      const queueCheckpoint = () => {
        void enqueue(async () => {
          if (pending !== checkpoint) {
            return;
          }

          pending = undefined;
          lastCheckpointAt = performance.now();

          try {
            await checkpoint.save();
            checkpoint.resolve();
          } catch (error) {
            checkpoint.reject(error);
          }
        });
      };

      const delay = lastCheckpointAt + STREAM_CHECKPOINT_INTERVAL_MS - performance.now();

      if (delay > 0) {
        checkpoint.timer = setTimeout(queueCheckpoint, Math.ceil(delay));
      } else {
        queueCheckpoint();
      }
    });
  }

  return { submit, discardCheckpoint };
}
