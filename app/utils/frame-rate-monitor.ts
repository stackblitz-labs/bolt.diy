/* eslint-disable @typescript-eslint/naming-convention, consistent-return */
/**
 * Frame Rate Monitor
 * Tracks frame rate during animations and streaming to ensure smooth 60fps performance
 * Can also target 120fps on high-refresh-rate displays
 */

export class FrameRateMonitor {
  private frames = 0;
  private lastTime = performance.now();
  private isRunning = false;
  private rafId: number | null = null;
  private targetFps: number;
  private onUpdate?: (fps: number, droppedFrames: number) => void;
  private frameHistory: number[] = [];
  private readonly HISTORY_SIZE = 60; // Track last 60 frames

  constructor(targetFps: number = 60, onUpdate?: (fps: number, droppedFrames: number) => void) {
    this.targetFps = targetFps;
    this.onUpdate = onUpdate;
  }

  /**
   * Start monitoring frame rate
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.frames = 0;
    this.lastTime = performance.now();
    this.frameHistory = [];
    this.measure();
  }

  /**
   * Stop monitoring frame rate
   */
  stop(): void {
    this.isRunning = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get current FPS
   */
  getCurrentFps(): number {
    if (this.frameHistory.length === 0) {
      return 0;
    }

    const avgFrameTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;

    return Math.round(1000 / avgFrameTime);
  }

  /**
   * Get percentage of frames that met the target budget
   */
  getFrameBudgetCompliance(): number {
    if (this.frameHistory.length === 0) {
      return 100;
    }

    const targetFrameTime = 1000 / this.targetFps;
    const framesInBudget = this.frameHistory.filter((t) => t <= targetFrameTime).length;

    return (framesInBudget / this.frameHistory.length) * 100;
  }

  /**
   * Get statistics about frame times
   */
  getStats(): {
    currentFps: number;
    avgFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    droppedFrames: number;
    budgetCompliance: number;
  } {
    if (this.frameHistory.length === 0) {
      return {
        currentFps: 0,
        avgFrameTime: 0,
        minFrameTime: 0,
        maxFrameTime: 0,
        droppedFrames: 0,
        budgetCompliance: 100,
      };
    }

    const targetFrameTime = 1000 / this.targetFps;
    const avgFrameTime = this.frameHistory.reduce((a, b) => a + b, 0) / this.frameHistory.length;
    const droppedFrames = this.frameHistory.filter((t) => t > targetFrameTime).length;

    return {
      currentFps: Math.round(1000 / avgFrameTime),
      avgFrameTime,
      minFrameTime: Math.min(...this.frameHistory),
      maxFrameTime: Math.max(...this.frameHistory),
      droppedFrames,
      budgetCompliance: this.getFrameBudgetCompliance(),
    };
  }

  /**
   * Reset all stats
   */
  reset(): void {
    this.frames = 0;
    this.lastTime = performance.now();
    this.frameHistory = [];
  }

  private measure = (): void => {
    if (!this.isRunning) {
      return;
    }

    this.frames++;

    const now = performance.now();
    const frameTime = now - this.lastTime;

    // Track individual frame times
    this.frameHistory.push(frameTime);

    if (this.frameHistory.length > this.HISTORY_SIZE) {
      this.frameHistory.shift();
    }

    // Calculate FPS every second
    const delta = now - this.lastTime;

    if (delta >= 1000) {
      const fps = Math.round((this.frames * 1000) / delta);
      const targetFrameTime = 1000 / this.targetFps;
      const droppedFrames = this.frameHistory.filter((t) => t > targetFrameTime).length;

      if (this.onUpdate) {
        this.onUpdate(fps, droppedFrames);
      }

      this.frames = 0;
      this.lastTime = now;
    }

    this.rafId = requestAnimationFrame(this.measure);
  };
}

/**
 * React hook for monitoring frame rate
 */
export function useFrameRateMonitor(
  targetFps: number = 60,
  enabled: boolean = true,
): {
  fps: number;
  droppedFrames: number;
  stats: ReturnType<FrameRateMonitor['getStats']>;
} {
  const [fps, setFps] = React.useState(0);
  const [droppedFrames, setDroppedFrames] = React.useState(0);

  const [stats, setStats] = React.useState<ReturnType<FrameRateMonitor['getStats']>>({
    currentFps: 0,
    avgFrameTime: 0,
    minFrameTime: 0,
    maxFrameTime: 0,
    droppedFrames: 0,
    budgetCompliance: 100,
  });

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const monitor = new FrameRateMonitor(targetFps, (newFps, newDroppedFrames) => {
      setFps(newFps);
      setDroppedFrames(newDroppedFrames);
      setStats(monitor.getStats());
    });

    monitor.start();

    return () => {
      monitor.stop();
    };
  }, [targetFps, enabled]);

  return { fps, droppedFrames, stats };
}

/**
 * Measure main thread blocking time during a function execution
 */
export async function measureMainThreadBlocking<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; blockingTime: number; totalTime: number }> {
  const start = performance.now();

  let blockingTime = 0;
  let lastCheck = start;

  // Check blocking time periodically
  const checkInterval = setInterval(() => {
    const now = performance.now();
    const gap = now - lastCheck;

    // If gap > 16ms, we likely blocked the main thread
    if (gap > 16) {
      blockingTime += gap - 16;
    }

    lastCheck = now;
  }, 1);

  try {
    const result = await fn();
    const totalTime = performance.now() - start;
    clearInterval(checkInterval);

    return { result, blockingTime, totalTime };
  } catch (error) {
    clearInterval(checkInterval);
    throw error;
  }
}

// Re-export React for the hook
import React from 'react';
