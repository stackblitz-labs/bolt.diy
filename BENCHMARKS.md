# Benchmarks Guide

## Overview

This project includes performance benchmarks to measure and compare the speed of different operations.

## Running Benchmarks

### Option 1: Use Performance Tests (Current Approach)

Since Vitest bench mode has compatibility issues with our setup, we use regular performance tests:

```bash
# Run all performance tests
pnpm run perf:test

# Run specific performance test
pnpm test tests/performance/string-operations.bench.ts
```

### Option 2: Manual Benchmarking

For quick one-off benchmarks, use `console.time`:

```typescript
console.time('operation');
// your code here
console.timeEnd('operation');
```

### Option 3: Using performance.now()

```typescript
const start = performance.now();
// your code here
const end = performance.now();
console.log(`Duration: ${end - start}ms`);
```

## Benchmark Files

We have several benchmark files in `tests/performance/`:

1. **message-rendering.bench.ts** - Message list rendering performance
2. **string-operations.bench.ts** - String manipulation and V8 optimization
3. **data-structures.bench.ts** - Array vs Set vs Map comparisons

## Writing Benchmarks

### Format 1: As Performance Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('My Benchmark', () => {
  it('should measure operation speed', () => {
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      // operation to benchmark
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    
    console.log(`Average: ${avgDuration.toFixed(4)}ms per operation`);
    
    // Optional: assert performance budget
    expect(avgDuration).toBeLessThan(1); // Should be under 1ms
  });
});
```

### Format 2: Comparison Benchmarks

```typescript
describe('Array vs Set Performance', () => {
  const size = 1000;
  const array = Array.from({ length: size }, (_, i) => i);
  const set = new Set(array);

  it('Array.includes', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      array.includes(500);
    }
    const duration = performance.now() - start;
    console.log(`Array.includes: ${duration.toFixed(2)}ms`);
  });

  it('Set.has', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      set.has(500);
    }
    const duration = performance.now() - start;
    console.log(`Set.has: ${duration.toFixed(2)}ms`);
  });
});
```

## Benchmark Categories

### 1. Message Rendering
- Rendering 10/50/100 messages
- Filtering by role
- Finding by ID
- Sorting by timestamp
- Building message trees

### 2. String Operations  
- V8 optimization (Latin-1 vs two-byte)
- String concatenation methods
- Regex performance
- Code tokenization
- URL parsing

### 3. Data Structures
- Array vs Set vs Map lookup
- Object vs Map for key-value storage
- Array method performance
- Memoization strategies
- Shallow vs deep operations

## Performance Tips from Benchmarks

### From String Operations
- **Avoid non-Latin-1 characters in hot paths** - em dashes force V8's slow two-byte path
- **Use array.join() for many concatenations** - faster than + operator
- **Prefer .includes() over regex for simple checks** - less overhead

### From Data Structures
- **Use Set for lookups** - O(1) vs O(n) for Array.includes
- **Use Map for dynamic key-value** - faster than Object for frequent updates
- **Avoid deep cloning in hot paths** - JSON.parse/stringify is expensive

### From Message Rendering
- **Memoize finished blocks** - don't re-render what hasn't changed
- **Use virtualization for long lists** - only render visible items
- **Batch DOM updates** - minimize reflows

## Interpreting Results

When comparing results:

1. **Run multiple times** - First run may be slower (cold start)
2. **Look at relative performance** - 2x faster is significant, 5% is noise
3. **Consider real-world context** - Micro-optimizations matter in hot paths only
4. **Profile in production** - Lab results don't always match production

## Example Output

```
✓ Array.includes (1000 items) - 2.34ms
✓ Set.has (1000 items) - 0.12ms
✓ Map.has (1000 items) - 0.11ms

Result: Set/Map are ~20x faster than Array for lookups
```

## Future: Vitest Bench Mode

Once we upgrade Vitest or fix the configuration, we can use the native bench API:

```typescript
import { bench, describe } from 'vitest';

describe('suite', () => {
  bench('faster', () => {
    // fast code
  });

  bench('slower', () => {
    // slow code
  });
});
```

Run with:
```bash
vitest bench
```

## Resources

- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)
- [MDN Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [V8 String Optimization](https://v8.dev/blog/elements-kinds)
