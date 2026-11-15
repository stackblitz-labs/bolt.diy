import { searchWithRipgrep } from './ripgrep';
import type { RipgrepOptions } from './ripgrep';

self.onmessage = async (event: MessageEvent<RipgrepOptions>) => {
  try {
    const result = await searchWithRipgrep(event.data);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
};
