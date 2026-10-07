/**
 * Performance Monitoring Utility
 * Inspired by Claude.dev's performance optimization sprint
 * 
 * Tracks key user journeys and metrics for continuous performance improvement
 */

interface PerformanceEvent {
  journey: string;
  duration: number;
  timestamp: number;
  userAgent: string;
  metadata?: Record<string, any>;
}

interface JourneyMark {
  startMark: string;
  endMark: string;
  measureName: string;
}

export class PerformanceMonitor {
  private static readonly STORAGE_KEY = 'bolt_performance_events';
  private static readonly MAX_EVENTS = 1000; // Keep last 1000 events
  private static isEnabled = true;

  /**
   * Track a user journey with duration and metadata
   */
  static trackJourney(
    name: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const event: PerformanceEvent = {
      journey: name,
      duration,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      ...metadata,
    };

    this.logPerformanceEvent(event);
    
    // Also log to console in dev mode
    if (import.meta.env.DEV) {
      console.log(
        `⚡ Performance: ${name} took ${duration.toFixed(2)}ms`,
        metadata
      );
    }
  }

  /**
   * Measure an async operation
   */
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.trackJourney(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackJourney(name, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  static measureSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.trackJourney(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.trackJourney(name, duration, {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Start a manual measurement (use with endMeasurement)
   */
  static startMeasurement(name: string): void {
    performance.mark(`${name}-start`);
  }

  /**
   * End a manual measurement and track it
   */
  static endMeasurement(name: string, metadata?: Record<string, any>): void {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = name;

    performance.mark(endMark);
    
    try {
      performance.measure(measureName, startMark, endMark);
      const measure = performance.getEntriesByName(measureName)[0];
      
      if (measure) {
        this.trackJourney(name, measure.duration, metadata);
      }
      
      // Clean up marks
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(measureName);
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
    }
  }

  /**
   * Track Core Web Vitals
   */
  static async trackWebVitals(): Promise<void> {
    try {
      const { onCLS, onFCP, onFID, onLCP, onTTFB, onINP } = await import('web-vitals');
      
      onCLS((metric) => this.trackJourney('web-vital-cls', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));
      
      onFCP((metric) => this.trackJourney('web-vital-fcp', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));
      
      onFID((metric) => this.trackJourney('web-vital-fid', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));
      
      onLCP((metric) => this.trackJourney('web-vital-lcp', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));
      
      onTTFB((metric) => this.trackJourney('web-vital-ttfb', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));

      onINP((metric) => this.trackJourney('web-vital-inp', metric.value, {
        rating: metric.rating,
        id: metric.id,
      }));
    } catch (error) {
      console.warn('Failed to load web-vitals:', error);
    }
  }

  /**
   * Monitor layout shifts
   */
  static monitorLayoutShifts(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.hadRecentInput) continue;
          
          this.trackJourney('layout-shift', entry.value * 1000, {
            sources: entry.sources?.map((s: any) => ({
              node: s.node?.tagName,
              previousRect: s.previousRect,
              currentRect: s.currentRect,
            })),
          });
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('Failed to observe layout shifts:', error);
    }
  }

  /**
   * Monitor long tasks (> 50ms)
   */
  static monitorLongTasks(): void {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.trackJourney('long-task', entry.duration, {
            entryType: entry.entryType,
            startTime: entry.startTime,
          });
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      // longtask is not supported in all browsers
      console.debug('Long task monitoring not supported');
    }
  }

  /**
   * Get all stored performance events
   */
  static getEvents(): PerformanceEvent[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get statistics for a specific journey
   */
  static getJourneyStats(journeyName: string): {
    count: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    avg: number;
  } | null {
    const events = this.getEvents().filter((e) => e.journey === journeyName);
    
    if (events.length === 0) return null;

    const durations = events.map((e) => e.duration).sort((a, b) => a - b);
    
    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * durations.length) - 1;
      return durations[index];
    };

    return {
      count: events.length,
      p50: percentile(50),
      p75: percentile(75),
      p95: percentile(95),
      p99: percentile(99),
      min: durations[0],
      max: durations[durations.length - 1],
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
    };
  }

  /**
   * Get all journey names
   */
  static getJourneyNames(): string[] {
    const events = this.getEvents();
    return [...new Set(events.map((e) => e.journey))];
  }

  /**
   * Clear all stored events
   */
  static clearEvents(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear events:', error);
    }
  }

  /**
   * Export events as JSON
   */
  static exportEvents(): string {
    return JSON.stringify(this.getEvents(), null, 2);
  }

  /**
   * Initialize all monitoring
   */
  static init(): void {
    if (typeof window === 'undefined') return;

    // Track Web Vitals
    this.trackWebVitals();

    // Monitor layout shifts
    this.monitorLayoutShifts();

    // Monitor long tasks
    this.monitorLongTasks();

    // Track initial page load
    if (document.readyState === 'complete') {
      this.trackPageLoad();
    } else {
      window.addEventListener('load', () => this.trackPageLoad());
    }
  }

  /**
   * Disable performance monitoring
   */
  static disable(): void {
    this.isEnabled = false;
  }

  /**
   * Enable performance monitoring
   */
  static enable(): void {
    this.isEnabled = true;
  }

  // Private methods

  private static logPerformanceEvent(event: PerformanceEvent): void {
    try {
      const events = this.getEvents();
      events.push(event);

      // Keep only the most recent events
      if (events.length > this.MAX_EVENTS) {
        events.splice(0, events.length - this.MAX_EVENTS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      // Storage might be full or unavailable
      console.debug('Failed to log performance event:', error);
    }
  }

  private static trackPageLoad(): void {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      this.trackJourney('page-load', navigation.loadEventEnd - navigation.fetchStart, {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart,
        type: navigation.type,
      });
    }
  }
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  PerformanceMonitor.init();
}
