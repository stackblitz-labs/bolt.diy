/**
 * Performance Monitoring System
 * Based on Claude.dev's approach: measure everything, then optimize
 *
 * Core User Journeys:
 * - App Launch: Time to interactive on fresh load
 * - Starting Chat: Time to typeable composer
 * - Loading Project: Time to show existing conversation
 * - Sending Message: Time from send to first token
 * - Code Preview: Time to render WebContainer preview
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export type { PerformanceMetric };

interface JourneyMarks {
  [key: string]: number;
}

class PerformanceMonitor {
  private _metrics: PerformanceMetric[] = [];
  private _journeyMarks: Map<string, JourneyMarks> = new Map();
  private _enabled = typeof window !== 'undefined';

  /**
   * Mark the start of a user journey
   */
  markStart(journey: string, label: string = 'start') {
    if (!this._enabled) {
      return;
    }

    const markName = `${journey}:${label}`;
    performance.mark(markName);

    if (!this._journeyMarks.has(journey)) {
      this._journeyMarks.set(journey, {});
    }

    const marks = this._journeyMarks.get(journey)!;
    marks[label] = performance.now();
  }

  /**
   * Mark the end of a user journey and record the measurement
   */
  markEnd(journey: string, label: string = 'end', metadata?: Record<string, any>): number | null {
    if (!this._enabled) {
      return null;
    }

    const endMarkName = `${journey}:${label}`;
    performance.mark(endMarkName);

    const marks = this._journeyMarks.get(journey);

    if (!marks || !marks.start) {
      console.warn(`[PERF] No start mark found for journey: ${journey}`);
      return null;
    }

    const startMarkName = `${journey}:start`;
    const measureName = `${journey}:${label}`;

    try {
      performance.measure(measureName, startMarkName, endMarkName);

      const measure = performance.getEntriesByName(measureName)[0] as PerformanceMeasure;
      const duration = measure.duration;

      // Record the metric
      this.recordMetric(measureName, duration, metadata);

      // Clean up marks for this journey
      this._journeyMarks.delete(journey);

      return duration;
    } catch (_error) {
      console.error(`[PERF] Error measuring ${journey}:`, _error);
      return null;
    }
  }

  /**
   * Record a metric directly without marks
   */
  recordMetric(name: string, duration: number, metadata?: Record<string, any>) {
    if (!this._enabled) {
      return;
    }

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this._metrics.push(metric);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`, metadata || '');
    }

    // Send to analytics in production
    if (import.meta.env.PROD) {
      this._sendToAnalytics(metric);
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this._metrics];
  }

  /**
   * Get metrics for a specific journey
   */
  getJourneyMetrics(journey: string): PerformanceMetric[] {
    return this._metrics.filter((m) => m.name.startsWith(journey));
  }

  /**
   * Calculate percentiles for a set of durations
   */
  calculatePercentiles(durations: number[]): { p50: number; p75: number; p95: number; p99: number } {
    if (durations.length === 0) {
      return { p50: 0, p75: 0, p95: 0, p99: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);

    return {
      p50: this._percentile(sorted, 50),
      p75: this._percentile(sorted, 75),
      p95: this._percentile(sorted, 95),
      p99: this._percentile(sorted, 99),
    };
  }

  private _percentile(sorted: number[], p: number): number {
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Send metrics to analytics service
   */
  private _sendToAnalytics(metric: PerformanceMetric) {
    /*
     * Integration point for analytics services
     * Could be sent to: Datadog, New Relic, custom backend, etc.
     */
    if (typeof window !== 'undefined' && (window as any).__PERFORMANCE_ANALYTICS__) {
      (window as any).__PERFORMANCE_ANALYTICS__(metric);
    }
  }

  /**
   * Clear all metrics
   */
  clear() {
    this._metrics = [];
    this._journeyMarks.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Generate a performance report
   */
  generateReport(): string {
    const journeys = new Map<string, number[]>();

    this._metrics.forEach((metric) => {
      const journey = metric.name.split(':')[0];

      if (!journeys.has(journey)) {
        journeys.set(journey, []);
      }

      journeys.get(journey)!.push(metric.duration);
    });

    let report = '=== Performance Report ===\n\n';

    journeys.forEach((durations, journey) => {
      const stats = this.calculatePercentiles(durations);
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

      report += `${journey}:\n`;
      report += `  Count: ${durations.length}\n`;
      report += `  Average: ${avg.toFixed(2)}ms\n`;
      report += `  p50: ${stats.p50.toFixed(2)}ms\n`;
      report += `  p75: ${stats.p75.toFixed(2)}ms\n`;
      report += `  p95: ${stats.p95.toFixed(2)}ms\n`;
      report += `  p99: ${stats.p99.toFixed(2)}ms\n\n`;
    });

    return report;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Core journey measurement helpers
export const journeys = {
  /**
   * App Launch Journey: Fresh page load to interactive
   */
  appLaunch: {
    start: () => performanceMonitor.markStart('app-launch'),
    htmlParsed: () => performanceMonitor.markStart('app-launch', 'html-parsed'),
    reactHydrated: () => performanceMonitor.markStart('app-launch', 'react-hydrated'),
    interactive: (metadata?: Record<string, any>) => performanceMonitor.markEnd('app-launch', 'interactive', metadata),
  },

  /**
   * Composer Journey: From mount to typeable
   */
  composer: {
    start: () => performanceMonitor.markStart('composer'),
    mounted: () => performanceMonitor.markStart('composer', 'mounted'),
    typeable: (metadata?: Record<string, any>) => performanceMonitor.markEnd('composer', 'typeable', metadata),
  },

  /**
   * Message Send Journey: From send click to first token
   */
  messageSend: {
    start: (messageId: string) => performanceMonitor.markStart(`message-send-${messageId}`),
    requestSent: (messageId: string) => performanceMonitor.markStart(`message-send-${messageId}`, 'request-sent'),
    firstToken: (messageId: string, metadata?: Record<string, any>) =>
      performanceMonitor.markEnd(`message-send-${messageId}`, 'first-token', metadata),
  },

  /**
   * Project Load Journey: From navigation to visible
   */
  projectLoad: {
    start: (projectId: string) => performanceMonitor.markStart(`project-load-${projectId}`),
    dataLoaded: (projectId: string) => performanceMonitor.markStart(`project-load-${projectId}`, 'data-loaded'),
    rendered: (projectId: string, metadata?: Record<string, any>) =>
      performanceMonitor.markEnd(`project-load-${projectId}`, 'rendered', metadata),
  },

  /**
   * WebContainer Boot Journey
   */
  webContainer: {
    start: () => performanceMonitor.markStart('webcontainer-boot'),
    apiLoaded: () => performanceMonitor.markStart('webcontainer-boot', 'api-loaded'),
    booted: (metadata?: Record<string, any>) => performanceMonitor.markEnd('webcontainer-boot', 'booted', metadata),
  },

  /**
   * Code Preview Journey: From code change to visible preview
   */
  preview: {
    start: (fileId: string) => performanceMonitor.markStart(`preview-${fileId}`),
    compiled: (fileId: string) => performanceMonitor.markStart(`preview-${fileId}`, 'compiled'),
    rendered: (fileId: string, metadata?: Record<string, any>) =>
      performanceMonitor.markEnd(`preview-${fileId}`, 'rendered', metadata),
  },
};

// Web Vitals integration
export function observeWebVitals() {
  if (typeof window === 'undefined') {
    return;
  }

  // Cumulative Layout Shift
  let clsValue = 0;

  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!(entry as any).hadRecentInput) {
        clsValue += (entry as any).value;
        performanceMonitor.recordMetric('web-vitals:cls', clsValue);
      }
    }
  });

  try {
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch {
    // Layout shift not supported
  }

  // Largest Contentful Paint
  const lcpObserver = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    performanceMonitor.recordMetric('web-vitals:lcp', lastEntry.startTime);
  });

  try {
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // LCP not supported
  }

  // First Input Delay
  const fidObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      performanceMonitor.recordMetric('web-vitals:fid', (entry as any).processingStart - entry.startTime);
    }
  });

  try {
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {
    // FID not supported
  }
}

// Export for debugging in console
if (typeof window !== 'undefined') {
  (window as any).__BOLT_PERFORMANCE__ = {
    monitor: performanceMonitor,
    journeys,
    report: () => console.log(performanceMonitor.generateReport()),
  };
}
