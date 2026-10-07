/**
 * Data Structure Performance Benchmarks
 * Compare different data structure approaches for common operations
 * 
 * Note: These are benchmark reference implementations.
 * Run with: pnpm test tests/performance/data-structures.bench.ts
 */

import { describe, it, expect } from 'vitest';

describe('Array vs Set vs Map', () => {
  const size = 1000;
  const array = Array.from({ length: size }, (_, i) => i);
  const set = new Set(array);
  const map = new Map(array.map((v) => [v, v]));

  it('should benchmark Array.includes vs Set.has vs Map.has', () => {
    const iterations = 1000;
    
    // Array.includes
    const arrayStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      array.includes(500);
    }
    const arrayTime = performance.now() - arrayStart;
    
    // Set.has
    const setStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      set.has(500);
    }
    const setTime = performance.now() - setStart;
    
    // Map.has
    const mapStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      map.has(500);
    }
    const mapTime = performance.now() - mapStart;
    
    console.log(`Array.includes: ${arrayTime.toFixed(2)}ms`);
    console.log(`Set.has: ${setTime.toFixed(2)}ms`);
    console.log(`Map.has: ${mapTime.toFixed(2)}ms`);
    
    // Set and Map should be much faster
    expect(setTime).toBeLessThan(arrayTime);
    expect(mapTime).toBeLessThan(arrayTime);
  });
});

describe('Object vs Map for Key-Value Storage', () => {
  const size = 1000;
  const obj: Record<string, number> = {};
  const map = new Map<string, number>();

  for (let i = 0; i < size; i++) {
    const key = `key${i}`;
    obj[key] = i;
    map.set(key, i);
  }

  it('should benchmark Object vs Map access', () => {
    const iterations = 10000;
    
    const objStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const val = obj['key500'];
    }
    const objTime = performance.now() - objStart;
    
    const mapStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const val = map.get('key500');
    }
    const mapTime = performance.now() - mapStart;
    
    console.log(`Object access: ${objTime.toFixed(2)}ms`);
    console.log(`Map access: ${mapTime.toFixed(2)}ms`);
    
    expect(objTime).toBeGreaterThan(0);
    expect(mapTime).toBeGreaterThan(0);
  });
});

describe('Array Methods Performance', () => {
  const arr = Array.from({ length: 1000 }, (_, i) => i);

  it('should benchmark array operations', () => {
    const mapStart = performance.now();
    const mapped = arr.map((x) => x * 2);
    const mapTime = performance.now() - mapStart;
    
    const filterStart = performance.now();
    const filtered = arr.filter((x) => x % 2 === 0);
    const filterTime = performance.now() - filterStart;
    
    const reduceStart = performance.now();
    const sum = arr.reduce((sum, x) => sum + x, 0);
    const reduceTime = performance.now() - reduceStart;
    
    console.log(`Array.map: ${mapTime.toFixed(2)}ms`);
    console.log(`Array.filter: ${filterTime.toFixed(2)}ms`);
    console.log(`Array.reduce: ${reduceTime.toFixed(2)}ms`);
    
    expect(mapped.length).toBe(1000);
    expect(filtered.length).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(0);
  });
});
