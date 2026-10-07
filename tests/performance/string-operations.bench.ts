/**
 * String Operations Benchmarks
 * Based on Claude.dev's findings about V8 optimization
 * 
 * Note: These are benchmark reference implementations.
 * Run with: pnpm test tests/performance/string-operations.bench.ts
 */

import { describe, it, expect } from 'vitest';
import { optimizeForHighlighting } from '~/lib/performance/streaming-optimizer';

describe('String Processing - V8 Optimization', () => {
  const textWithEmDash = 'This code is amazing—truly revolutionary content here'.repeat(100);
  const plainText = 'This code is amazing truly revolutionary content here'.repeat(100);

  it('should show V8 optimization difference', () => {
    const iterations = 1000;
    
    const emDashStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      textWithEmDash.match(/\w+/g);
    }
    const emDashTime = performance.now() - emDashStart;
    
    const plainStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      plainText.match(/\w+/g);
    }
    const plainTime = performance.now() - plainStart;
    
    console.log(`With em-dash (slow): ${emDashTime.toFixed(2)}ms`);
    console.log(`Plain ASCII (fast): ${plainTime.toFixed(2)}ms`);
    
    expect(plainTime).toBeLessThanOrEqual(emDashTime);
  });

  it('should optimize strings for highlighting', () => {
    const optimized = optimizeForHighlighting(textWithEmDash);
    expect(optimized).toBeTruthy();
    expect(/[^\x00-\xFF]/.test(optimized)).toBe(false); // Should be Latin-1 only
  });
});

describe('String Manipulation', () => {
  const longString = 'A'.repeat(10000);

  it('should benchmark concatenation methods', () => {
    const plusStart = performance.now();
    let result1 = '';
    for (let i = 0; i < 1000; i++) {
      result1 = result1 + 'x';
    }
    const plusTime = performance.now() - plusStart;

    const joinStart = performance.now();
    const parts = [];
    for (let i = 0; i < 1000; i++) {
      parts.push('x');
    }
    const result2 = parts.join('');
    const joinTime = performance.now() - joinStart;

    console.log(`+ concatenation: ${plusTime.toFixed(2)}ms`);
    console.log(`array.join(): ${joinTime.toFixed(2)}ms`);

    expect(result1.length).toBe(1000);
    expect(result2.length).toBe(1000);
  });
});

describe('Code Highlighting Prep', () => {
  const code = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
  `.trim();

  const codeWithUnicode = code.replace(/'/g, '\'').replace(/"/g, '"').replace(/-/g, '—');

  it('should tokenize code efficiently', () => {
    const plainStart = performance.now();
    const plainTokens = code.match(/\b\w+\b|[^\w\s]/g);
    const plainTime = performance.now() - plainStart;

    const unicodeStart = performance.now();
    const unicodeTokens = codeWithUnicode.match(/\b\w+\b|[^\w\s]/g);
    const unicodeTime = performance.now() - unicodeStart;

    const optimizedStart = performance.now();
    const optimized = optimizeForHighlighting(codeWithUnicode);
    const optimizedTokens = optimized.match(/\b\w+\b|[^\w\s]/g);
    const optimizedTime = performance.now() - optimizedStart;

    console.log(`Plain code: ${plainTime.toFixed(4)}ms`);
    console.log(`With Unicode: ${unicodeTime.toFixed(4)}ms`);
    console.log(`Optimized: ${optimizedTime.toFixed(4)}ms`);

    expect(plainTokens).toBeTruthy();
    expect(unicodeTokens).toBeTruthy();
    expect(optimizedTokens).toBeTruthy();
  });
});
