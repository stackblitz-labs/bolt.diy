/**
 * Environment-agnostic test setup.
 *
 * Everything here runs in both the `node` and `dom` Vitest projects, so it must
 * not touch `window`, `document` or `localStorage` — referencing any of them
 * throws under the `node` environment and takes the whole file down at import.
 *
 * The DOM-specific mocks live in ./setup-dom.ts, which only the jsdom project
 * loads. This split exists because that setup file is the reason every test used
 * to require jsdom: ~25 of them exercise pure logic (diffing, path handling,
 * parser output, schema validation) and had no reason to pay for a DOM.
 */

import { expect, afterEach, vi } from 'vitest';

afterEach(() => {
  vi.clearAllMocks();
});

/** Custom matchers, available in every project. */
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;

    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    }

    return {
      message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass: false,
    };
  },
});

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeWithinRange(floor: number, ceiling: number): T;
    }
    interface AsymmetricMatchersContaining {
      toBeWithinRange(floor: number, ceiling: number): any;
    }
  }
}