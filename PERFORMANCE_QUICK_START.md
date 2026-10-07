# Performance Optimization - Quick Start

## 🚀 Quick Commands

```bash
# Run performance tests
pnpm run perf:test

# Run benchmarks
pnpm run benchmarks

# Watch benchmarks
pnpm run benchmarks:watch

# Analyze bundle sizes
pnpm run perf:analyze

# Full performance report
pnpm run perf:report

# Check budgets
pnpm run perf:check
```

## 📊 Measure User Journeys

```typescript
import { journeys } from '~/lib/performance';

// App Launch
journeys.appLaunch.start();
journeys.appLaunch.interactive();

// Composer
journeys.composer.start();
journeys.composer.typeable();

// Message Send
journeys.messageSend.start(messageId);
journeys.messageSend.firstToken(messageId);

// Project Load
journeys.projectLoad.start(projectId);
journeys.projectLoad.rendered(projectId);

// WebContainer
journeys.webContainer.start();
journeys.webContainer.booted();
```

## 🎯 Core Optimizations

### 1. Prefetch on Hover
```typescript
import { usePrefetchOnHover } from '~/lib/performance';

const prefetch = usePrefetchOnHover(
  itemId,
  () => loadItem(itemId),
  50 // 50ms delay
);

<div
  onMouseEnter={prefetch.onMouseEnter}
  onMouseLeave={prefetch.onMouseLeave}
  onClick={() => prefetch.fetch()}
/>
```

### 2. Static Composer
```typescript
import { StaticComposer, useStaticComposer } from '~/components/chat/StaticComposer';

const { isReady, handleReady } = useStaticComposer();
<StaticComposer onReady={handleReady} />
```

### 3. Memoize Blocks
```typescript
import { ContentBlockMemoizer } from '~/lib/performance';

const memoizer = new ContentBlockMemoizer();
const block = memoizer.get(blockId, () => renderBlock());
```

### 4. Lazy Load Components
```typescript
import { useLazyWithPrefetch } from '~/lib/hooks/usePerformanceOptimizedRender';

const { component, load } = useLazyWithPrefetch(
  () => import('./HeavyComponent'),
  shouldPrefetch
);
```

### 5. Optimize CodeMirror
```typescript
import { languageCache, preprocessCodeForHighlighting } from '~/lib/performance';

// Lazy load language
const lang = await languageCache.get('typescript');

// Optimize code
const optimized = preprocessCodeForHighlighting(code);
```

### 6. Throttle Updates
```typescript
import { useThrottledState } from '~/lib/hooks/usePerformanceOptimizedRender';

const [value, setValue] = useThrottledState(''); // Max 60fps updates
```

## 🔍 Debug in Console

```javascript
// Performance report
window.__BOLT_PERFORMANCE__.report()

// Streaming stats
window.__BOLT_STREAMING__.getStats()

// Journey metrics
window.__BOLT_PERFORMANCE__.monitor.getJourneyMetrics('composer')

// All metrics
window.__BOLT_PERFORMANCE__.monitor.getMetrics()
```

## 📈 Performance Budgets

| Journey | Budget | Unit |
|---------|--------|------|
| App Launch | 550 | ms |
| Composer Typeable | 100 | ms |
| Message First Token | 300 | ms |
| Project Load | 730 | ms |
| WebContainer Boot | 2000 | ms |
| Frame Budget (60fps) | 16.67 | ms |
| Frame Budget (120fps) | 8.33 | ms |

## ✅ Best Practices

1. **Keep components mounted** - Hide with CSS, don't unmount
2. **Memoize expensive computations** - Use `useMemo` with proper deps
3. **Virtualize long lists** - Only render visible items
4. **Lazy load heavy components** - Split bundles
5. **Batch DOM updates** - Use `batchedDOMUpdater`
6. **Prefetch on hover** - Make navigation instant
7. **Measure everything** - Add instrumentation first

## 🎯 Quick Wins Checklist

- [ ] Add performance monitoring to new features
- [ ] Prefetch on hover for navigation
- [ ] Keep composer mounted between conversations
- [ ] Lazy load language modes in CodeMirror
- [ ] Virtualize message lists if >50 items
- [ ] Batch updates during streaming
- [ ] Pre-boot WebContainer early
- [ ] Add static composer for instant typing
- [ ] Optimize images and assets
- [ ] Code split large dependencies

## 📚 Resources

- [Full Documentation](./PERFORMANCE.md)
- [Performance Budgets](./.performance-budgets.json)
- [Claude.dev Blog](https://claude.dev/blog/how-we-made-claude-ai-faster/)

## 🆘 Need Help?

1. Check [PERFORMANCE.md](./PERFORMANCE.md)
2. Open issue with `performance` label
3. Ask in Discord `#performance` channel
