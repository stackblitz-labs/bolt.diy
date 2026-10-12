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

export function searchWithRipgrep(request: SearchRequest, signal?: AbortSignal) {
  return new Promise<RipgrepResult>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Search was cancelled.', 'AbortError'));
      return;
    }

    const worker = new Worker(new URL('./ripgrep.worker.ts', import.meta.url), { type: 'module' });

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
      reject(new Error(event.message || 'Ripgrep worker failed.'));
    };
    worker.postMessage(request);
  });
}
