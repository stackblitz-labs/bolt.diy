/**
 * Performance Monitor Unit Tests
 * 
 * Tests the core functionality of the PerformanceMonitor utility
 * Following TDD principles: test behavior, edge cases, and error conditions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '~/utils/performance-monitor';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    // Clear any existing events before each test
    PerformanceMonitor.clearEvents();
    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trackJourney', () => {
    it('should track a journey with duration and metadata', () => {
      PerformanceMonitor.trackJourney('test-journey', 100, { foo: 'bar' });

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].journey).toBe('test-journey');
      expect(events[0].duration).toBe(100);
      expect(events[0].foo).toBe('bar');
    });

    it('should store events in localStorage', () => {
      PerformanceMonitor.trackJourney('test', 50);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'bolt_performance_events',
        expect.stringContaining('test')
      );
    });

    it('should not track when disabled', () => {
      PerformanceMonitor.disable();
      PerformanceMonitor.trackJourney('test', 100);

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(0);

      PerformanceMonitor.enable();
    });
  });

  describe('measureAsync', () => {
    it('should measure async operation duration', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      const result = await PerformanceMonitor.measureAsync('async-test', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].journey).toBe('async-test');
      expect(events[0].duration).toBeGreaterThan(0);
    });

    it('should track duration even when operation throws', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(
        PerformanceMonitor.measureAsync('failing-test', operation)
      ).rejects.toThrow('test error');

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].journey).toBe('failing-test');
      expect(events[0].error).toBe('test error');
    });

    it('should include metadata in tracked event', async () => {
      const operation = vi.fn().mockResolvedValue('result');

      await PerformanceMonitor.measureAsync('test', operation, { userId: '123' });

      const events = PerformanceMonitor.getEvents();
      expect(events[0].userId).toBe('123');
    });
  });

  describe('measureSync', () => {
    it('should measure sync operation duration', () => {
      const operation = vi.fn().mockReturnValue('result');

      const result = PerformanceMonitor.measureSync('sync-test', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].journey).toBe('sync-test');
      expect(events[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should track duration even when operation throws', () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error('sync error');
      });

      expect(() => PerformanceMonitor.measureSync('failing-sync', operation)).toThrow('sync error');

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].error).toBe('sync error');
    });
  });

  describe('startMeasurement and endMeasurement', () => {
    it('should measure duration between start and end', () => {
      PerformanceMonitor.startMeasurement('manual-test');

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // wait 10ms
      }

      PerformanceMonitor.endMeasurement('manual-test');

      const events = PerformanceMonitor.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].journey).toBe('manual-test');
      expect(events[0].duration).toBeGreaterThanOrEqual(10);
    });

    it('should include metadata in end measurement', () => {
      PerformanceMonitor.startMeasurement('test-with-meta');
      PerformanceMonitor.endMeasurement('test-with-meta', { result: 'success' });

      const events = PerformanceMonitor.getEvents();
      expect(events[0].result).toBe('success');
    });
  });

  describe('getJourneyStats', () => {
    it('should calculate statistics for a journey', () => {
      // Add multiple events with known durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      durations.forEach((duration) => {
        PerformanceMonitor.trackJourney('stats-test', duration);
      });

      const stats = PerformanceMonitor.getJourneyStats('stats-test');

      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(10);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(100);
      expect(stats!.avg).toBe(55);
      expect(stats!.p50).toBe(50);
      expect(stats!.p75).toBe(75);
    });

    it('should return null for non-existent journey', () => {
      const stats = PerformanceMonitor.getJourneyStats('does-not-exist');
      expect(stats).toBeNull();
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 events with sequential durations
      for (let i = 1; i <= 100; i++) {
        PerformanceMonitor.trackJourney('percentile-test', i);
      }

      const stats = PerformanceMonitor.getJourneyStats('percentile-test');

      expect(stats!.p50).toBeCloseTo(50, 0);
      expect(stats!.p75).toBeCloseTo(75, 0);
      expect(stats!.p95).toBeCloseTo(95, 0);
      expect(stats!.p99).toBeCloseTo(99, 0);
    });
  });

  describe('getJourneyNames', () => {
    it('should return all unique journey names', () => {
      PerformanceMonitor.trackJourney('journey-1', 10);
      PerformanceMonitor.trackJourney('journey-2', 20);
      PerformanceMonitor.trackJourney('journey-1', 30);

      const names = PerformanceMonitor.getJourneyNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('journey-1');
      expect(names).toContain('journey-2');
    });

    it('should return empty array when no events', () => {
      const names = PerformanceMonitor.getJourneyNames();
      expect(names).toHaveLength(0);
    });
  });

  describe('clearEvents', () => {
    it('should clear all stored events', () => {
      PerformanceMonitor.trackJourney('test-1', 10);
      PerformanceMonitor.trackJourney('test-2', 20);

      expect(PerformanceMonitor.getEvents()).toHaveLength(2);

      PerformanceMonitor.clearEvents();

      expect(PerformanceMonitor.getEvents()).toHaveLength(0);
    });

    it('should remove data from localStorage', () => {
      PerformanceMonitor.trackJourney('test', 10);
      PerformanceMonitor.clearEvents();

      expect(localStorage.removeItem).toHaveBeenCalledWith('bolt_performance_events');
    });
  });

  describe('exportEvents', () => {
    it('should export events as JSON string', () => {
      PerformanceMonitor.trackJourney('export-test', 100, { custom: 'data' });

      const exported = PerformanceMonitor.exportEvents();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].journey).toBe('export-test');
      expect(parsed[0].duration).toBe(100);
      expect(parsed[0].custom).toBe('data');
    });

    it('should export empty array when no events', () => {
      const exported = PerformanceMonitor.exportEvents();
      expect(JSON.parse(exported)).toEqual([]);
    });
  });

  describe('enable and disable', () => {
    it('should enable and disable tracking', () => {
      PerformanceMonitor.enable();
      PerformanceMonitor.trackJourney('enabled', 10);
      expect(PerformanceMonitor.getEvents()).toHaveLength(1);

      PerformanceMonitor.disable();
      PerformanceMonitor.trackJourney('disabled', 20);
      expect(PerformanceMonitor.getEvents()).toHaveLength(1); // Still 1, not 2

      PerformanceMonitor.enable();
      PerformanceMonitor.trackJourney('enabled-again', 30);
      expect(PerformanceMonitor.getEvents()).toHaveLength(2);
    });
  });

  describe('event size limit', () => {
    it('should limit stored events to MAX_EVENTS', () => {
      // Track more than MAX_EVENTS (1000)
      for (let i = 0; i < 1100; i++) {
        PerformanceMonitor.trackJourney('overflow-test', i);
      }

      const events = PerformanceMonitor.getEvents();

      // Should keep only the last 1000
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('error handling', () => {
    it('should handle localStorage quota exceeded gracefully', () => {
      // Mock setItem to throw quota exceeded error
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      expect(() => {
        PerformanceMonitor.trackJourney('quota-test', 100);
      }).not.toThrow();
    });

    it('should handle corrupted localStorage data', () => {
      // Mock getItem to return invalid JSON
      vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('invalid json');

      // Should return empty array instead of crashing
      const events = PerformanceMonitor.getEvents();
      expect(events).toEqual([]);
    });
  });
});
