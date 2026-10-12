import type { FileMap } from '~/lib/stores/files';

interface SearchRequest {
  query: string;
  path?: string;
  limit?: number;
  caseInsensitive?: boolean;
  files: FileMap;
  projectRoot: string;
}

export interface RipgrepMatch {
  path: string;
  line?: number;
  text?: string;
  matchCharStart?: number;
  matchCharEnd?: number;
  matches: string[];
}

interface RipgrepResult {
  matches: RipgrepMatch[];
  truncated: boolean;
  resultCount: number;
  exitCode: number;
}

class RipgrepWorkerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RipgrepWorkerError';
  }
}

let workerUnavailable = false;

async function searchOnMainThread(request: SearchRequest, signal?: AbortSignal) {
  const { searchWithRipgrep: runSearch } = await import('./ripgrep');
  return runSearch({ ...request, signal });
}

export async function searchWithRipgrep(request: SearchRequest, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Search was cancelled.', 'AbortError');
  }

  if (workerUnavailable) {
    return searchOnMainThread(request, signal);
  }

  try {
    return await new Promise<RipgrepResult>((resolve, reject) => {
      let worker: Worker;

      try {
        worker = new Worker(new URL('./ripgrep.worker.ts', import.meta.url), { type: 'module' });
      } catch (error) {
        reject(new RipgrepWorkerError(error instanceof Error ? error.message : String(error)));
        return;
      }

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
      };
      const onAbort = () => {
        cleanup();
        reject(new DOMException('Search was cancelled.', 'AbortError'));
      };

      signal?.addEventListener('abort', onAbort, { once: true });

      worker.onmessage = (event: MessageEvent<{ success: boolean; result?: RipgrepResult; error?: string }>) => {
        cleanup();

        if (event.data.success && event.data.result) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || 'Ripgrep search failed.'));
        }
      };

      worker.onerror = (event) => {
        cleanup();

        const details = event.error instanceof Error ? event.error.message : event.message;

        const location = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : '';
        reject(new RipgrepWorkerError(`${details || 'Ripgrep worker failed.'}${location}`));
      };

      worker.postMessage(request);
    });
  } catch (error) {
    if (signal?.aborted || !(error instanceof RipgrepWorkerError)) {
      throw error;
    }

    workerUnavailable = true;

    /*
     * Some dev and embedded browser environments cannot load module workers reliably.
     * Search is bounded by project and file limits in ripgrep.ts, so fall back to the
     * same WASM engine on the main thread instead of making search unavailable.
     */
    return searchOnMainThread(request, signal);
  }
}
