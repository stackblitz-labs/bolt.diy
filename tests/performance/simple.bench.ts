/**
 * Simple Benchmark Test
 * 
 * Note: These are benchmark reference implementations.
 */

import { describe, it, expect } from 'vitest';

describe('Array Operations', () => {
  it('should benchmark array operations', () => {
    const pushStart = performance.now();
    const arr1 = [];
    for (let i = 0; i < 1000; i++) {
      arr1.push(i);
    }
    const pushTime = performance.now() - pushStart;

    const spreadStart = performance.now();
    const arr2 = [...Array(1000).keys()];
    const spreadTime = performance.now() - spreadStart;

    console.log(`push 1000 items: ${pushTime.toFixed(2)}ms`);
    console.log(`spread 1000 items: ${spreadTime.toFixed(2)}ms`);

    expect(arr1.length).toBe(1000);
    expect(arr2.length).toBe(1000);
  });
});
