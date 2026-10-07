/**
 * Prefetching utilities for faster navigation
 * Based on Claude.dev's hover prefetching strategy
 */

interface PrefetchOptions {
  priority?: 'high' | 'low';
  timeout?: number;
}

class PrefetchManager {
  private _cache: Map<string, Promise<any>> = new Map();
  private _pendingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Prefetch a resource (data, component, etc.)
   */
  prefetch<T>(key: string, loader: () => Promise<T>, options: PrefetchOptions = {}): void {
    // Don't prefetch if already cached or loading
    if (this._cache.has(key)) {
      return;
    }

    const { timeout = 0 } = options;

    if (timeout > 0) {
      // Delay prefetch (useful for hover interactions)
      const timeoutId = setTimeout(() => {
        this._executePrefetch(key, loader);
        this._pendingTimeouts.delete(key);
      }, timeout);

      this._pendingTimeouts.set(key, timeoutId);
    } else {
      this._executePrefetch(key, loader);
    }
  }

  /**
   * Get prefetched data or load it now
   */
  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    // Cancel any pending prefetch timeout since we need the data now
    const timeout = this._pendingTimeouts.get(key);

    if (timeout) {
      clearTimeout(timeout);
      this._pendingTimeouts.delete(key);
    }

    if (!this._cache.has(key)) {
      this._cache.set(key, loader());
    }

    return this._cache.get(key) as Promise<T>;
  }

  /**
   * Cancel a pending prefetch
   */
  cancel(key: string): void {
    const timeout = this._pendingTimeouts.get(key);

    if (timeout) {
      clearTimeout(timeout);
      this._pendingTimeouts.delete(key);
    }
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this._pendingTimeouts.forEach((timeout) => clearTimeout(timeout));
    this._pendingTimeouts.clear();
    this._cache.clear();
  }

  /**
   * Clear a specific cache entry
   */
  invalidate(key: string): void {
    this.cancel(key);
    this._cache.delete(key);
  }

  private _executePrefetch<T>(key: string, loader: () => Promise<T>): void {
    const promise = loader().catch((error) => {
      // Remove failed prefetch from cache so it can be retried
      this._cache.delete(key);
      console.warn(`[PREFETCH] Failed to prefetch ${key}:`, error);
      throw error;
    });

    this._cache.set(key, promise);
  }
}

// Singleton instance
export const prefetchManager = new PrefetchManager();

/**
 * React hook for prefetching on hover
 */
export function usePrefetchOnHover<T>(
  key: string | null,
  loader: () => Promise<T>,
  delay: number = 50,
): {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  fetch: () => Promise<T>;
} {
  return {
    onMouseEnter: () => {
      if (key) {
        prefetchManager.prefetch(key, loader, { timeout: delay });
      }
    },
    onMouseLeave: () => {
      if (key) {
        prefetchManager.cancel(key);
      }
    },
    fetch: async () => {
      if (!key) {
        return loader();
      }

      return prefetchManager.get(key, loader);
    },
  };
}

/**
 * Prefetch component chunks
 */
export function prefetchComponent(importFn: () => Promise<any>): void {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback for low-priority prefetching
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 1);
    }
  }
}

/**
 * Prefetch on viewport intersection
 */
export function prefetchOnVisible(
  element: HTMLElement | null,
  loader: () => Promise<any>,
  options: IntersectionObserverInit = {},
): () => void {
  if (!element || typeof IntersectionObserver === 'undefined') {
    return () => {
      /* noop */
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          loader();
          observer.disconnect();
        }
      });
    },
    {
      rootMargin: '50px',
      ...options,
    },
  );

  observer.observe(element);

  return () => observer.disconnect();
}
