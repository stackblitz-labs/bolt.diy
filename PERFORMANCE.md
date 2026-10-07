# Performance Optimization Guide

This document describes the performance optimization system implemented in bolt.diy, based on the approach used by Claude.dev to achieve 3x performance improvements.

## Philosophy

> **"Measuring something makes it tractable. Anything we could count, Claude could climb."**  
> — Claude.dev team

Our approach:
1. **Measure first** - Add instrumentation to core user journeys
2. **Set budgets** - Establish performance budgets (ratchets that only go down)
3. **Iterate rapidly** - Make improvements and validate with benchmarks
4. **Lock in wins** - Update budgets when improvements are made

## Core User Journeys

We track performance for these critical paths:

### 1. App Launch
- **Metric**: Time from page load to interactive
- **Budget**: 550ms (p75)
- **Measurement**: `journeys.appLaunch.start()` → `journeys.appLaunch.interactive()`

### 2. Composer Typeable
- **Metric**: Time from mount to user can type
- **Budget**: 100ms
- **Measurement**: `journeys.composer.start()` → `journeys.composer.typeable()`

### 3. Message Send
- **Metric**: Time from send click to first AI token
- **Budget**: 300ms
- **Measurement**: `journeys.messageSend.start()` → `journeys.messageSend.firstToken()`

### 4. Project Load
- **Metric**: Time to load existing conversation
- **Budget**: 730ms
- **Measurement**: `journeys.projectLoad.start()` → `journeys.projectLoad.rendered()`

### 5. WebContainer Boot
- **Metric**: Time to boot WebContainer
- **Budget**: 2000ms
- **Measurement**: `journeys.webContainer.start()` → `journeys.webContainer.booted()`

## Key Optimizations Implemented

### 1. Performance Monitoring System
Location: `app/lib/performance/metrics.ts`

```typescript
import { performanceMonitor, journeys } from '~/lib/performance';

// Mark start of a journey
journeys.appLaunch.start();

// Mark end and record duration
journeys.appLaunch.interactive({ theme: 'dark' });

// Access in console
window.__BOLT_PERFORMANCE__.report();
```

### 2. Static Composer
Location: `app/components/chat/StaticComposer.tsx`

**Before**: User waits 200-300ms for React to hydrate before typing  
**After**: User can type immediately (<100ms)

The static composer renders a plain HTML textarea that's immediately interactive, then React seamlessly takes over.

```typescript
import { StaticComposer, useStaticComposer } from '~/components/chat/StaticComposer';

function App() {
  const { isReady, handleReady } = useStaticComposer();
  
  return <StaticComposer onReady={handleReady} />;
}
```

### 3. Prefetching
Location: `app/lib/performance/prefetch.ts`

Prefetch data on hover to make navigation feel instant:

```typescript
import { usePrefetchOnHover } from '~/lib/performance';

function ChatListItem({ chatId }) {
  const prefetch = usePrefetchOnHover(
    chatId,
    () => fetch(`/api/chats/${chatId}`),
    50 // delay 50ms
  );
  
  return (
    <div
      onMouseEnter={prefetch.onMouseEnter}
      onMouseLeave={prefetch.onMouseLeave}
      onClick={() => prefetch.fetch()}
    >
      Chat {chatId}
    </div>
  );
}
```

### 4. Streaming Optimization
Location: `app/lib/performance/streaming-optimizer.ts`

**Goal**: Hold 60fps (16.6ms/frame) or 120fps (8.3ms/frame) during streaming

```typescript
import { streamingOptimizer, ContentBlockMemoizer } from '~/lib/performance';

// Memoize finished blocks
const memoizer = new ContentBlockMemoizer();
const renderedBlock = memoizer.get(blockId, () => renderBlock(block));

// Check frame stats
const stats = streamingOptimizer.getStats();
console.log(`Dropped ${stats.droppedFrames} frames`);
```

### 5. WebContainer Pre-boot
Location: `app/lib/performance/webcontainer-optimizer.ts`

Start booting WebContainer in the background early:

```typescript
import { prebootWebContainer, getWebContainer } from '~/lib/performance';

// Early in app lifecycle
useEffect(() => {
  prebootWebContainer(); // Start boot in background
}, []);

// Later when needed
const container = await getWebContainer(); // Already booted!
```

### 6. CodeMirror Optimization
Location: `app/lib/performance/codemirror-optimizer.ts`

Optimizations:
- Lazy-load language modes (only load JS/HTML initially)
- Preprocess code to avoid V8's slow two-byte path
- Limit highlighting to viewport for large files

```typescript
import { languageCache, preprocessCodeForHighlighting } from '~/lib/performance';

// Lazy load language
const langExtension = await languageCache.get('typescript');

// Optimize code before highlighting
const optimizedCode = preprocessCodeForHighlighting(code);
```

### 7. Performance-Optimized Hooks
Location: `app/lib/hooks/usePerformanceOptimizedRender.ts`

```typescript
import { useStableCallback, useThrottledState } from '~/lib/hooks/usePerformanceOptimizedRender';

// Stable callback (doesn't trigger re-renders)
const handleChange = useStableCallback((value) => {
  console.log(value);
}, []);

// Throttled state (max 60fps updates)
const [value, setValue] = useThrottledState('');
```

## Performance Budgets

All budgets are defined in `.performance-budgets.json` and enforced in CI.

### CI Ratchets

Budgets can **only decrease**, never increase. When you make an improvement:

1. Run tests: `pnpm run perf:test`
2. If you beat the budget by 10%+, update `.performance-budgets.json`
3. Add entry to history with date and note

Example:
```json
{
  "composer-typeable": {
    "budget": 85,
    "unit": "ms",
    "history": [
      { "date": "2024-01-01", "value": 100, "note": "Initial baseline" },
      { "date": "2024-01-15", "value": 85, "note": "Static composer optimization" }
    ]
  }
}
```

## Running Performance Tests

```bash
# Run all performance tests
pnpm run perf:test

# Analyze bundle sizes
pnpm run perf:analyze

# Check against budgets
pnpm run perf:check

# Full report
pnpm run perf:report
```

## Monitoring in Production

Performance metrics are automatically collected and can be sent to analytics:

```typescript
// In your analytics setup
window.__PERFORMANCE_ANALYTICS__ = (metric) => {
  // Send to your analytics service
  analytics.track('performance', {
    name: metric.name,
    duration: metric.duration,
    metadata: metric.metadata,
  });
};
```

## Web Vitals

We track Core Web Vitals:
- **CLS** (Cumulative Layout Shift): < 0.1
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **INP** (Interaction to Next Paint): < 200ms

Access in console:
```javascript
window.__BOLT_PERFORMANCE__.monitor.getMetrics()
  .filter(m => m.name.startsWith('web-vitals'));
```

## Layout Stability

We have integration tests to catch layout shifts:

```bash
pnpm run test:integration tests/integration/layout-stability.test.ts
```

Key areas tested:
- Composer doesn't shift on mount
- Sidebar stable when data loads
- No shift during message streaming
- Scrollbar doesn't cause shifts

## Best Practices

### 1. Keep Composer Mounted
Don't unmount/remount the composer between conversations:

```typescript
// ❌ Bad
{showChat && <Composer />}

// ✅ Good
<Composer style={{ display: showChat ? 'block' : 'none' }} />
```

### 2. Memoize Heavy Computations
```typescript
const processedMessages = useMemo(() => {
  return messages.map(processMessage);
}, [messages.length]); // Only when length changes
```

### 3. Virtualize Long Lists
```typescript
import { useVirtualizedList } from '~/lib/hooks/usePerformanceOptimizedRender';

const { visibleItems, totalHeight, onScroll } = useVirtualizedList(
  items,
  containerHeight,
  itemHeight
);
```

### 4. Lazy Load Heavy Components
```typescript
const CodeEditor = lazy(() => import('./CodeEditor'));

// Or with prefetch
const { component, load } = useLazyWithPrefetch(
  () => import('./CodeEditor'),
  shouldPrefetch
);
```

### 5. Batch DOM Updates
```typescript
import { batchedDOMUpdater } from '~/lib/performance';

// Schedule multiple updates
batchedDOMUpdater.schedule(() => updateElement1());
batchedDOMUpdater.schedule(() => updateElement2());
// Executed together in next frame
```

## Debugging Performance

### Console Helpers

```javascript
// Get full performance report
window.__BOLT_PERFORMANCE__.report()

// Get streaming stats
window.__BOLT_STREAMING__.getStats()

// Check specific journey
window.__BOLT_PERFORMANCE__.monitor.getJourneyMetrics('composer')
```

### React DevTools Profiler

1. Open React DevTools
2. Go to Profiler tab
3. Click record
4. Perform action
5. Look for slow renders (>16ms)

### Chrome Performance Tab

1. Open DevTools → Performance
2. Record while performing action
3. Look for:
   - Long tasks (>50ms)
   - Layout shifts
   - Forced reflows
   - Heavy JavaScript execution

## Performance Sprint Workflow

Based on Claude.dev's approach:

1. **Pick a journey** - Choose one to optimize
2. **Add instrumentation** - Measure current performance
3. **Set baseline** - Record p50, p75, p95 times
4. **Identify bottlenecks** - Profile and find slow parts
5. **Make improvements** - Implement optimizations
6. **Validate** - Run benchmarks to confirm improvement
7. **Ratchet down** - Update budget in `.performance-budgets.json`
8. **Repeat** - Move to next journey

## Resources

- [Claude.dev Performance Blog Post](https://claude.dev/blog/how-we-made-claude-ai-faster/)
- [Web Vitals](https://web.dev/vitals/)
- [React Performance Profiling](https://react.dev/learn/render-and-commit#profiling)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

## Questions?

Open an issue or discussion with the `performance` label.
