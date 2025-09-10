/**
 * Memoization Utilities for Performance Optimization
 * Author: Keoma Wright
 * Purpose: Cache expensive function results to improve performance
 */

interface MemoizeOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (...args: any[]) => string;
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

/**
 * Creates a memoized version of a function with configurable cache
 */
export function memoize<T extends (...args: any[]) => any>(fn: T, options: MemoizeOptions = {}): T {
  const { maxSize = 100, ttl = 60000, keyGenerator = defaultKeyGenerator } = options;
  const cache = new Map<string, CacheEntry<ReturnType<T>>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check if we have a valid cached result
    if (cache.has(key)) {
      const entry = cache.get(key)!;

      if (!ttl || now - entry.timestamp < ttl) {
        return entry.value;
      }

      // Remove expired entry
      cache.delete(key);
    }

    // Compute result
    const result = fn(...args);

    // Cache result
    cache.set(key, { value: result, timestamp: now });

    // Enforce max size
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;

      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    return result;
  }) as T;
}

/**
 * Creates a memoized async function
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T, options: MemoizeOptions = {}): T {
  const { maxSize = 100, ttl = 60000, keyGenerator = defaultKeyGenerator } = options;
  const cache = new Map<string, CacheEntry<Promise<Awaited<ReturnType<T>>>>>();
  const pendingCache = new Map<string, Promise<Awaited<ReturnType<T>>>>();

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const key = keyGenerator(...args);
    const now = Date.now();

    // Check if we have a pending request for this key
    if (pendingCache.has(key)) {
      return pendingCache.get(key)!;
    }

    // Check if we have a valid cached result
    if (cache.has(key)) {
      const entry = cache.get(key)!;

      if (!ttl || now - entry.timestamp < ttl) {
        return entry.value;
      }

      // Remove expired entry
      cache.delete(key);
    }

    // Create promise for this computation
    const promise = fn(...args);
    pendingCache.set(key, promise);

    try {
      const result = await promise;

      // Cache successful result
      cache.set(key, { value: Promise.resolve(result), timestamp: now });

      // Enforce max size
      if (cache.size > maxSize) {
        const firstKey = cache.keys().next().value;

        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }

      return result;
    } finally {
      // Remove from pending cache
      pendingCache.delete(key);
    }
  }) as T;
}

/**
 * Default key generator for memoization
 */
function defaultKeyGenerator(...args: any[]): string {
  return JSON.stringify(args, (_, value) => {
    // Handle special types
    if (value instanceof Set) {
      return [...value];
    }

    if (value instanceof Map) {
      return Object.fromEntries(value);
    }

    if (typeof value === 'function') {
      return value.toString();
    }

    return value;
  });
}

/**
 * Weak memoization for object arguments
 */
export function weakMemoize<T extends (arg: object) => any>(fn: T): T {
  const cache = new WeakMap<object, ReturnType<T>>();

  return ((arg: object): ReturnType<T> => {
    if (cache.has(arg)) {
      return cache.get(arg)!;
    }

    const result = fn(arg);
    cache.set(arg, result);

    return result;
  }) as T;
}

/**
 * LRU (Least Recently Used) cache implementation
 */
export class LRUCache<K, V> {
  private _cache = new Map<K, V>();
  private _maxSize: number;

  constructor(maxSize: number = 100) {
    this._maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this._cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this._cache.get(key)!;
    this._cache.delete(key);
    this._cache.set(key, value);

    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists (to update position)
    if (this._cache.has(key)) {
      this._cache.delete(key);
    } else if (this._cache.size >= this._maxSize) {
      // Remove least recently used (first item)
      const firstKey = this._cache.keys().next().value;

      if (firstKey !== undefined) {
        this._cache.delete(firstKey);
      }
    }

    this._cache.set(key, value);
  }

  has(key: K): boolean {
    return this._cache.has(key);
  }

  clear(): void {
    this._cache.clear();
  }

  get size(): number {
    return this._cache.size;
  }
}

/**
 * Memoize with LRU cache
 */
export function memoizeLRU<T extends (...args: any[]) => any>(fn: T, maxSize: number = 100): T {
  const cache = new LRUCache<string, ReturnType<T>>(maxSize);

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);

    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);

    return result;
  }) as T;
}

/**
 * Clear all memoization caches (useful for testing)
 */
export function clearAllCaches(): void {
  /*
   * This would need to track all created caches
   * For now, it's a placeholder for manual cache management
   */
  console.log('Cache clearing requested');
}
