/**
 * Syntax Highlighter Client
 * Interface for using the web worker-based syntax highlighter
 */

import type { BundledLanguage, BundledTheme } from 'shiki';

interface PendingRequest {
  resolve: (html: string) => void;
  reject: (error: Error) => void;
}

export class SyntaxHighlighterClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private requestCounter = 0;
  private cache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 500;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(
        new URL('../workers/syntax-highlighter.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.addEventListener('message', (event) => {
        const { id, html, error } = event.data;
        const pending = this.pendingRequests.get(id);

        if (pending) {
          this.pendingRequests.delete(id);

          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(html);
          }
        }
      });

      this.worker.addEventListener('error', (error) => {
        console.error('Worker error:', error);
        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Worker error'));
        });
        this.pendingRequests.clear();
      });
    } catch (error) {
      console.error('Failed to initialize syntax highlighter worker:', error);
    }
  }

  /**
   * Highlight code with caching
   */
  async highlight(
    code: string,
    language: BundledLanguage,
    theme: BundledTheme = 'dark-plus'
  ): Promise<string> {
    // Check cache first
    const cacheKey = `${language}:${theme}:${code}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    // If worker is not available, return plain text
    if (!this.worker) {
      return this.fallbackHighlight(code);
    }

    // Create a promise for this request
    const id = `highlight-${++this.requestCounter}`;
    
    const promise = new Promise<string>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Highlight request timeout'));
        }
      }, 5000);
    });

    // Send request to worker
    this.worker.postMessage({
      id,
      code,
      language,
      theme,
    });

    try {
      const html = await promise;
      
      // Cache the result
      this.cache.set(cacheKey, html);
      
      // Limit cache size (LRU-like)
      if (this.cache.size > this.MAX_CACHE_SIZE) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
      
      return html;
    } catch (error) {
      console.error('Highlight error:', error);
      return this.fallbackHighlight(code);
    }
  }

  /**
   * Fallback to plain text rendering
   */
  private fallbackHighlight(code: string): string {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    return `<pre><code>${escaped}</code></pre>`;
  }

  /**
   * Preload commonly used languages
   */
  async preload(): Promise<void> {
    // Worker initializes automatically with common languages
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
    };
  }

  /**
   * Terminate the worker
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.cache.clear();
  }
}

// Singleton instance
let instance: SyntaxHighlighterClient | null = null;

/**
 * Get the singleton syntax highlighter instance
 */
export function getSyntaxHighlighter(): SyntaxHighlighterClient {
  if (!instance) {
    instance = new SyntaxHighlighterClient();
  }
  return instance;
}

/**
 * Convenience function for highlighting code
 */
export async function highlightCode(
  code: string,
  language: BundledLanguage,
  theme: BundledTheme = 'dark-plus'
): Promise<string> {
  const highlighter = getSyntaxHighlighter();
  return highlighter.highlight(code, language, theme);
}
