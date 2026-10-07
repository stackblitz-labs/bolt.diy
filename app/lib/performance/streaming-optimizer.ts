/**
 * Streaming Performance Optimizer
 * Based on Claude.dev's 120fps streaming approach
 * 
 * Key optimizations:
 * - Only touch DOM elements that are still changing
 * - Memoize finished blocks
 * - Move heavy work to Web Workers
 * - Target 60fps (16.6ms) or 120fps (8.3ms) frame budget
 */

interface FrameMetrics {
  frameNumber: number;
  duration: number;
  didDrop: boolean;
  timestamp: number;
}

class StreamingOptimizer {
  private frameMetrics: FrameMetrics[] = [];
  private frameCount = 0;
  private lastFrameTime = 0;
  private targetFPS = 60;
  private frameBudget = 16.67; // 60fps = 16.67ms per frame

  constructor() {
    if (typeof window !== 'undefined') {
      // Detect if device supports 120Hz
      if (window.screen && (window.screen as any).refreshRate >= 120) {
        this.targetFPS = 120;
        this.frameBudget = 8.33; // 120fps = 8.33ms per frame
      }
    }
  }

  /**
   * Track a frame's performance
   */
  trackFrame(workDuration: number): void {
    const now = performance.now();
    const frameTime = this.lastFrameTime > 0 ? now - this.lastFrameTime : 0;
    const didDrop = workDuration > this.frameBudget;

    this.frameMetrics.push({
      frameNumber: this.frameCount++,
      duration: workDuration,
      didDrop,
      timestamp: now,
    });

    this.lastFrameTime = now;

    // Keep only last 240 frames (2 seconds at 120fps)
    if (this.frameMetrics.length > 240) {
      this.frameMetrics.shift();
    }

    if (didDrop && import.meta.env.DEV) {
      console.warn(`[STREAMING] Frame ${this.frameCount} dropped: ${workDuration.toFixed(2)}ms (budget: ${this.frameBudget}ms)`);
    }
  }

  /**
   * Get current frame rate statistics
   */
  getStats(): {
    targetFPS: number;
    frameBudget: number;
    droppedFrames: number;
    averageFrameTime: number;
    percentDropped: number;
  } {
    const droppedFrames = this.frameMetrics.filter((m) => m.didDrop).length;
    const averageFrameTime =
      this.frameMetrics.reduce((sum, m) => sum + m.duration, 0) / this.frameMetrics.length || 0;

    return {
      targetFPS: this.targetFPS,
      frameBudget: this.frameBudget,
      droppedFrames,
      averageFrameTime,
      percentDropped: (droppedFrames / this.frameMetrics.length) * 100 || 0,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.frameMetrics = [];
    this.frameCount = 0;
    this.lastFrameTime = 0;
  }

  /**
   * Check if we're within frame budget
   */
  isWithinBudget(duration: number): boolean {
    return duration <= this.frameBudget;
  }

  /**
   * Get remaining frame budget
   */
  getRemainingBudget(elapsed: number): number {
    return Math.max(0, this.frameBudget - elapsed);
  }
}

export const streamingOptimizer = new StreamingOptimizer();

/**
 * Batch DOM updates to stay within frame budget
 */
export class BatchedDOMUpdater {
  private pendingUpdates: Array<() => void> = [];
  private rafId: number | null = null;

  /**
   * Schedule a DOM update
   */
  schedule(update: () => void): void {
    this.pendingUpdates.push(update);

    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Execute all pending updates within frame budget
   */
  private flush(): void {
    this.rafId = null;
    const frameStart = performance.now();
    const budget = streamingOptimizer.getRemainingBudget(0);

    let updateCount = 0;
    while (this.pendingUpdates.length > 0 && performance.now() - frameStart < budget * 0.8) {
      const update = this.pendingUpdates.shift()!;
      update();
      updateCount++;
    }

    const duration = performance.now() - frameStart;
    streamingOptimizer.trackFrame(duration);

    // If there are still pending updates, schedule another frame
    if (this.pendingUpdates.length > 0) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * Clear all pending updates
   */
  clear(): void {
    this.pendingUpdates = [];
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

/**
 * Memoize finished content blocks to avoid re-rendering
 */
export class ContentBlockMemoizer<T> {
  private cache: Map<string, T> = new Map();

  /**
   * Get or compute a block
   */
  get(key: string, compute: () => T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const value = compute();
    this.cache.set(key, value);
    return value;
  }

  /**
   * Check if a block is cached
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Invalidate a block
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached blocks
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Throttle function calls to match frame rate
 */
export function throttleToFrame<T extends (...args: any[]) => any>(fn: T): T {
  let rafId: number | null = null;
  let lastArgs: any[] = [];

  return ((...args: any[]) => {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        fn(...lastArgs);
      });
    }
  }) as T;
}

/**
 * Measure the performance of a render function
 */
export function measureRender<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  streamingOptimizer.trackFrame(duration);

  if (import.meta.env.DEV && !streamingOptimizer.isWithinBudget(duration)) {
    console.warn(`[STREAMING] Slow render: ${name} took ${duration.toFixed(2)}ms`);
  }

  return result;
}

/**
 * Optimize CodeMirror syntax highlighting for V8
 * Claude.dev found that non-Latin-1 characters force V8 to use slower two-byte path
 */
export function optimizeForHighlighting(code: string): string {
  // Check if string contains any non-Latin-1 characters
  const hasNonLatin1 = /[^\x00-\xFF]/.test(code);

  if (!hasNonLatin1) {
    return code; // Already optimized
  }

  // Replace problematic Unicode characters with ASCII equivalents
  return code
    .replace(/[\u2018\u2019]/g, "'") // Smart quotes to straight quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/\u2013/g, '-') // En dash
    .replace(/\u2014/g, '--') // Em dash
    .replace(/\u2026/g, '...') // Ellipsis
    .replace(/[^\x00-\xFF]/g, ' '); // Other non-Latin-1 to space
}

// Export singleton
export const batchedDOMUpdater = new BatchedDOMUpdater();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).__BOLT_STREAMING__ = {
    optimizer: streamingOptimizer,
    getStats: () => streamingOptimizer.getStats(),
  };
}
