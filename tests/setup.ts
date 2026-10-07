/**
 * Test Setup File
 * 
 * Global setup for all tests
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Worker API
class WorkerMock {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string | URL) {
    this.url = url.toString();
  }

  postMessage(data: any) {
    // Mock worker behavior - immediate fallback response
    setTimeout(() => {
      if (this.onmessage) {
        const event = new MessageEvent('message', {
          data: {
            id: data.id,
            html: `<pre><code>${data.code}</code></pre>`,
          },
        });
        this.onmessage(event);
      }
    }, 0);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message' && typeof listener === 'function') {
      this.onmessage = listener as (event: MessageEvent) => void;
    }
  }

  removeEventListener() {}

  terminate() {}
}

global.Worker = WorkerMock as any;

// Mock window.requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 0;
});

global.cancelAnimationFrame = vi.fn();

// Mock performance.mark and performance.measure
if (typeof performance !== 'undefined') {
  performance.mark = vi.fn();
  performance.measure = vi.fn();
  performance.clearMarks = vi.fn();
  performance.clearMeasures = vi.fn();
  performance.getEntriesByName = vi.fn(() => [{ duration: 10 } as any]);
  performance.getEntriesByType = vi.fn(() => [
    {
      fetchStart: 0,
      loadEventEnd: 100,
      domContentLoadedEventEnd: 50,
      domInteractive: 30,
      type: 'navigate',
    } as any,
  ]);
}

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = class PerformanceObserver {
  constructor(public callback: PerformanceObserverCallback) {}
  observe() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as any;

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Extend expect types
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(floor: number, ceiling: number): T;
  }
  interface AsymmetricMatchersContaining {
    toBeWithinRange(floor: number, ceiling: number): any;
  }
}
