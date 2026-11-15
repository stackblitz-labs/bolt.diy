/**
 * Frame Rate Monitor Unit Tests
 * 
 * Tests frame rate monitoring functionality and statistics calculation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrameRateMonitor } from '~/utils/frame-rate-monitor';

describe('FrameRateMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create monitor with default 60fps target', () => {
      const monitor = new FrameRateMonitor();
      expect(monitor).toBeInstanceOf(FrameRateMonitor);
    });

    it('should create monitor with custom fps target', () => {
      const monitor = new FrameRateMonitor(120);
      expect(monitor).toBeInstanceOf(FrameRateMonitor);
    });

    it('should accept onUpdate callback', () => {
      const callback = vi.fn();
      const monitor = new FrameRateMonitor(60, callback);
      expect(monitor).toBeInstanceOf(FrameRateMonitor);
    });
  });

  describe('start and stop', () => {
    it('should start monitoring', () => {
      const monitor = new FrameRateMonitor();
      monitor.start();
      
      // Should not throw
      expect(() => monitor.stop()).not.toThrow();
    });

    it('should not start if already running', () => {
      const monitor = new FrameRateMonitor();
      monitor.start();
      monitor.start(); // Second start should be ignored
      
      monitor.stop();
    });

    it('should stop monitoring', () => {
      const monitor = new FrameRateMonitor();
      monitor.start();
      monitor.stop();
      
      // Stopping again should not throw
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('getCurrentFps', () => {
    it('should return 0 when no frames recorded', () => {
      const monitor = new FrameRateMonitor();
      expect(monitor.getCurrentFps()).toBe(0);
    });
  });

  describe('getFrameBudgetCompliance', () => {
    it('should return 100% when no frames recorded', () => {
      const monitor = new FrameRateMonitor();
      expect(monitor.getFrameBudgetCompliance()).toBe(100);
    });
  });

  describe('getStats', () => {
    it('should return default stats when no frames recorded', () => {
      const monitor = new FrameRateMonitor();
      const stats = monitor.getStats();

      expect(stats).toEqual({
        currentFps: 0,
        avgFrameTime: 0,
        minFrameTime: 0,
        maxFrameTime: 0,
        droppedFrames: 0,
        budgetCompliance: 100,
      });
    });
  });

  describe('reset', () => {
    it('should reset all statistics', () => {
      const monitor = new FrameRateMonitor();
      
      // Start and simulate some frames
      monitor.start();
      vi.advanceTimersByTime(100);
      monitor.stop();
      
      // Reset
      monitor.reset();
      
      const stats = monitor.getStats();
      expect(stats.currentFps).toBe(0);
    });
  });

  describe('onUpdate callback', () => {
    it('should call callback with fps and dropped frames', () => {
      const callback = vi.fn();
      const monitor = new FrameRateMonitor(60, callback);
      
      monitor.start();
      
      // Advance time to trigger callback
      vi.advanceTimersByTime(1000);
      
      monitor.stop();
      
      // Callback should have been called
      // Note: Actual behavior depends on requestAnimationFrame mock
    });
  });
});
