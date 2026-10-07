/**
 * Performance Monitoring Integration Tests
 * 
 * Tests the complete performance monitoring workflow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '~/utils/performance-monitor';
import { FrameRateMonitor } from '~/utils/frame-rate-monitor';
import { SyntaxHighlighterClient } from '~/utils/syntax-highlighter-client';

describe('Performance Monitoring Integration', () => {
  beforeEach(() => {
    PerformanceMonitor.clearEvents();
  });

  describe('End-to-end performance tracking', () => {
    it('should track a complete user journey', async () => {
      // Start app
      PerformanceMonitor.startMeasurement('app-start');
      
      // Simulate some initialization
      await new Promise((resolve) => setTimeout(resolve, 10));
      
      PerformanceMonitor.endMeasurement('app-start');

      // User creates a chat
      await PerformanceMonitor.measureAsync('chat-init', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      // User sends a message
      PerformanceMonitor.measureSync('message-send', () => {
        // Process message
        return 'processed';
      });

      // Verify all journeys were tracked
      const journeys = PerformanceMonitor.getJourneyNames();
      expect(journeys).toContain('app-start');
      expect(journeys).toContain('chat-init');
      expect(journeys).toContain('message-send');

      // Verify stats
      const appStats = PerformanceMonitor.getJourneyStats('app-start');
      expect(appStats).not.toBeNull();
      expect(appStats!.count).toBe(1);
      expect(appStats!.avg).toBeGreaterThan(0);
    });

    it('should track multiple operations of the same journey', async () => {
      // Simulate multiple file loads
      for (let i = 0; i < 5; i++) {
        await PerformanceMonitor.measureAsync('file-load', async () => {
          await new Promise((resolve) => setTimeout(resolve, 5 + i));
        }, { fileId: `file-${i}` });
      }

      const stats = PerformanceMonitor.getJourneyStats('file-load');
      expect(stats!.count).toBe(5);
      expect(stats!.min).toBeGreaterThan(0);
      expect(stats!.max).toBeGreaterThan(stats!.min);
    });
  });

  describe('Performance monitoring with syntax highlighting', () => {
    it('should track syntax highlighting performance', async () => {
      const client = new SyntaxHighlighterClient();

      const code = 'const x: number = 5;';

      await PerformanceMonitor.measureAsync('syntax-highlight', async () => {
        await client.highlight(code, 'typescript');
      });

      const stats = PerformanceMonitor.getJourneyStats('syntax-highlight');
      expect(stats).not.toBeNull();
      expect(stats!.avg).toBeGreaterThan(0);
      expect(stats!.count).toBe(1);

      client.dispose();
    });

    it('should show performance improvement with caching', async () => {
      const client = new SyntaxHighlighterClient();
      const code = 'function test() { return true; }';

      // First highlight (cache miss)
      await PerformanceMonitor.measureAsync('highlight-uncached', async () => {
        await client.highlight(code, 'javascript');
      });

      // Second highlight (cache hit)
      await PerformanceMonitor.measureAsync('highlight-cached', async () => {
        await client.highlight(code, 'javascript');
      });

      const uncachedStats = PerformanceMonitor.getJourneyStats('highlight-uncached');
      const cachedStats = PerformanceMonitor.getJourneyStats('highlight-cached');

      // Cached should be faster (though both might be very fast)
      expect(cachedStats!.avg).toBeLessThanOrEqual(uncachedStats!.avg);

      client.dispose();
    });
  });

  describe('Frame rate monitoring during operations', () => {
    it('should monitor FPS during heavy operations', async () => {
      const monitor = new FrameRateMonitor(60);
      
      monitor.start();

      // Simulate heavy work
      await PerformanceMonitor.measureAsync('heavy-work', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      monitor.stop();

      const stats = monitor.getStats();
      
      // Should have collected some frame data
      expect(stats).toBeDefined();

      const perfStats = PerformanceMonitor.getJourneyStats('heavy-work');
      expect(perfStats).not.toBeNull();
    });
  });

  describe('Export and import workflow', () => {
    it('should export and re-import data', () => {
      // Track some journeys
      PerformanceMonitor.trackJourney('journey-1', 100);
      PerformanceMonitor.trackJourney('journey-2', 200);

      // Export
      const exported = PerformanceMonitor.exportEvents();
      const data = JSON.parse(exported);

      expect(data).toHaveLength(2);
      expect(data[0].journey).toBe('journey-1');
      expect(data[1].journey).toBe('journey-2');

      // Clear and verify empty
      PerformanceMonitor.clearEvents();
      expect(PerformanceMonitor.getEvents()).toHaveLength(0);

      // Could re-import here if we had an import method
    });
  });

  describe('Statistics aggregation', () => {
    it('should aggregate statistics across multiple journeys', () => {
      // Simulate a real usage pattern
      const journeys = [
        { name: 'page-load', durations: [1000, 1100, 1200, 900, 1050] },
        { name: 'api-call', durations: [150, 200, 180, 220, 160] },
        { name: 'render', durations: [50, 60, 55, 65, 52] },
      ];

      journeys.forEach(({ name, durations }) => {
        durations.forEach((duration) => {
          PerformanceMonitor.trackJourney(name, duration);
        });
      });

      // Verify all journeys tracked
      const allJourneys = PerformanceMonitor.getJourneyNames();
      expect(allJourneys).toHaveLength(3);

      // Get aggregate statistics
      const stats = allJourneys.map((name) => ({
        name,
        stats: PerformanceMonitor.getJourneyStats(name),
      }));

      // Verify each journey has complete stats
      stats.forEach(({ name, stats: journeyStats }) => {
        expect(journeyStats).not.toBeNull();
        expect(journeyStats!.count).toBe(5);
        expect(journeyStats!.p50).toBeGreaterThan(0);
        expect(journeyStats!.p95).toBeGreaterThan(journeyStats!.p50);
      });
    });
  });

  describe('Error scenarios', () => {
    it('should handle errors gracefully during measurements', async () => {
      const failingOperation = async () => {
        throw new Error('Operation failed');
      };

      // Should track duration even when operation fails
      await expect(
        PerformanceMonitor.measureAsync('failing-op', failingOperation)
      ).rejects.toThrow('Operation failed');

      const stats = PerformanceMonitor.getJourneyStats('failing-op');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);

      const events = PerformanceMonitor.getEvents();
      expect(events[0].error).toBe('Operation failed');
    });
  });

  describe('Performance budgets', () => {
    it('should identify journeys exceeding performance budgets', () => {
      const budgets = {
        'fast-operation': 10,
        'slow-operation': 100,
      };

      // Track operations
      PerformanceMonitor.trackJourney('fast-operation', 5);
      PerformanceMonitor.trackJourney('fast-operation', 8);
      PerformanceMonitor.trackJourney('slow-operation', 120); // Exceeds budget
      PerformanceMonitor.trackJourney('slow-operation', 150); // Exceeds budget

      // Check which journeys exceed budgets
      const journeys = PerformanceMonitor.getJourneyNames();
      const violations: string[] = [];

      journeys.forEach((journey) => {
        const stats = PerformanceMonitor.getJourneyStats(journey);
        const budget = budgets[journey as keyof typeof budgets];

        if (stats && stats.p95 > budget) {
          violations.push(journey);
        }
      });

      expect(violations).toContain('slow-operation');
      expect(violations).not.toContain('fast-operation');
    });
  });
});
