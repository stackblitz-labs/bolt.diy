# Performance Optimization Guide

This guide describes the performance utilities currently present in the repository and distinguishes them from planned or sample optimizations. Performance targets below are goals, not measured production guarantees.

## Overview

The repository includes utilities for:
- **Measurement** - Track all critical user journeys
- **Lab Benchmarks** - Fast iteration without waiting for deploys
- **Guardrails** - Run performance benchmarks and bundle budget checks in CI; benchmark and Lighthouse failures are informational, while bundle budget failures fail the workflow
- **Hill Climbing** - Continuously improve measurable metrics

## Architecture Changes

### 1. Performance Monitoring Infrastructure

**Location**: `app/utils/performance-monitor.ts`

Tracks explicitly instrumented journeys and metrics:
- Page load time
- Chat initialization
- Message send latency
- File operations
- The root app currently observes CLS, LCP, and legacy FID in `app/lib/performance/metrics.ts`. A separate utility supports FCP, LCP, CLS, INP, and TTFB when `PerformanceMonitor.trackWebVitals()` is called; confirm that call site before assuming those values are collected.
- Layout shifts
- Long tasks (>50ms)

**Usage**:
```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

// Track a journey
await PerformanceMonitor.measureAsync('chat-init', async () => {
  await initializeChat();
});

// Manual measurements
PerformanceMonitor.startMeasurement('file-load');
// ... do work
PerformanceMonitor.endMeasurement('file-load', { fileSize: 1024 });

// Get statistics
const stats = PerformanceMonitor.getJourneyStats('chat-init');
console.log(`P75: ${stats.p75}ms`);
```

### 2. Frame Rate Monitoring

**Location**: `app/utils/frame-rate-monitor.ts`

Monitors frame rate during animations and streaming to ensure smooth 60fps:

```typescript
import { FrameRateMonitor } from '~/utils/frame-rate-monitor';

const monitor = new FrameRateMonitor(60, (fps, droppedFrames) => {
  console.log(`Current FPS: ${fps}, Dropped: ${droppedFrames}`);
});

monitor.start();
// ... run animations
monitor.stop();

const stats = monitor.getStats();
```

**React Hook**:
```typescript
import { useFrameRateMonitor } from '~/utils/frame-rate-monitor';

function StreamingMessage() {
  const { fps, droppedFrames, stats } = useFrameRateMonitor(60, true);
  
  return <div>FPS: {fps}</div>;
}
```

### 3. Worker-Based Syntax Highlighting

**Location**: 
- `app/workers/syntax-highlighter.worker.ts` - Web worker
- `app/utils/syntax-highlighter-client.ts` - Client interface

Moves expensive syntax highlighting off the main thread to prevent UI blocking during streaming.

The worker/client utilities exist, but this alone does not mean the chat renderer uses them. Confirm the call site before attributing a performance improvement to worker-based highlighting.

**Usage**:
```typescript
import { highlightCode } from '~/utils/syntax-highlighter-client';

const html = await highlightCode(
  'console.log("Hello, world!");',
  'javascript'
);
```

Check `app/utils/syntax-highlighter-client.ts` for the current cache, language loading, fallback, and timeout behavior; keep this summary aligned with that implementation.

### 4. Static Composer (Time-to-Typeable)

**Location**: `app/components/chat/StaticComposer.tsx`

Provides markup and handoff helpers for an early input field. It is not currently wired into the main chat UI, so the suggested time savings are not measured or realized by default.

**Available helpers** (these are not currently connected to the main chat composer):
```typescript
import { injectStaticComposer, StaticComposer } from '~/components/chat/StaticComposer';

// Inject the early HTML input before React mounts, then render its handoff target.
injectStaticComposer();
<StaticComposer onReady={() => setComposerReady(true)} />
```

### 5. Performance Dashboard

**Location**: `app/components/debug/PerformanceDashboard.tsx`

Visual dashboard for viewing performance metrics:
- Journey statistics (P50, P75, P95, P99)
- Live FPS monitoring
- Export/clear data
- Performance ratings

**Usage**:
```typescript
import { PerformanceDashboard } from '~/components/debug/PerformanceDashboard';

// Add to your debug menu or keyboard shortcut
<PerformanceDashboard onClose={() => setShowDashboard(false)} />
```

## Performance Benchmarks

**Location**: `tests/performance/`

Performance tests and benchmarks are present. The current CI workflow invokes `pnpm run perf:test` with `continue-on-error`, so benchmark failures are informational. Bundle analysis also continues long enough to report results, then an explicit follow-up step fails the job when the bundle budget check fails. Lighthouse is informational.

### Chat Input Benchmarks
- Typing latency (target: <16ms per keystroke)
- Re-render performance
- Message submission processing

### Syntax Highlighting Benchmarks
- Small code blocks (target: <50ms)
- Large code blocks (target: <200ms)
- Streaming/incremental highlighting
- Cache effectiveness

**Run Benchmarks**:
```bash
# Run the performance test suite
pnpm run perf:test

# Run specific benchmark
pnpm exec vitest --run tests/performance/chat-input.perf.test.ts

# Run with detailed output
pnpm exec vitest --run tests/performance --reporter=verbose
```

## Key User Journeys to Track

These are useful paths to instrument; the list is not based on an activity analysis or a claim that it covers 95% of usage:

### 1. App Launch
- Cold start time (web & desktop)
- Time to typeable chat input
- Initial React hydration
- WebContainer initialization (lazy loaded)

**Instrumentation Points**:
```typescript
// In app entry point
PerformanceMonitor.startMeasurement('app-launch');

// When chat input is ready
PerformanceMonitor.endMeasurement('app-launch', {
  isElectron: process.env.IS_ELECTRON,
});
```

### 2. Starting a New Chat
- New conversation initialization
- Editor mount time
- Terminal setup

```typescript
PerformanceMonitor.measureAsync('chat-init', async () => {
  await initializeNewChat();
});
```

### 3. Loading Existing Project
- Conversation state restoration
- File tree rendering
- Editor content loading

```typescript
PerformanceMonitor.measureAsync('project-load', async () => {
  await loadProject(projectId);
}, { fileCount, projectSize });
```

### 4. Sending Messages & Streaming
- Message submission latency
- Streaming token render speed
- Code syntax highlighting during stream
- Terminal output rendering

```typescript
// Track message submission
PerformanceMonitor.startMeasurement('message-send');
await sendMessage(message);
PerformanceMonitor.endMeasurement('message-send');

// Monitor frame rate during streaming
const monitor = new FrameRateMonitor(60);
monitor.start();
// ... streaming happens
monitor.stop();
```

### 5. Code Editing & Preview
- CodeMirror typing latency
- Live preview refresh time
- File switching speed

```typescript
PerformanceMonitor.measureSync('file-switch', () => {
  switchToFile(fileId);
}, { fileSize, language });
```

## Performance Budgets

Target metrics for core journeys (P75):

| Journey | Target | Good | Needs Improvement | Poor |
|---------|--------|------|-------------------|------|
| App Launch → Typeable | <1s | <750ms | <1s | >1s |
| New Chat Init | <300ms | <200ms | <300ms | >300ms |
| Load Existing Project | <1s | <750ms | <1s | >1s |
| Message Send → First Token | <200ms | <150ms | <200ms | >200ms |
| Typing Latency (P95) | <16ms | <10ms | <16ms | >16ms |
| Frame Rate During Stream | 60fps | 60fps | 55-59fps | <55fps |
| Code Highlighting (small) | <50ms | <30ms | <50ms | >50ms |
| File Switching | <100ms | <50ms | <100ms | >100ms |

## Optimization Checklist

### Implemented utilities and remaining work
- [x] Add performance monitoring infrastructure
- [x] Create frame rate monitor
- [x] Move syntax highlighting to web worker
- [x] Create static composer for instant input
- [x] Add performance dashboard
- [x] Performance metrics and journey helpers exist; `app/root.tsx` observes Web Vitals and preboots WebContainer.
- [x] Prefetch, streaming, WebContainer, and CodeMirror optimization utilities exist under `app/lib/performance/`.
- [x] Performance tests, bundle analysis, and a budget-check script exist.
- [ ] Wire the static composer into the main chat UI if instant pre-hydration typing is still a product goal.
- [ ] Instrument remaining user journeys and confirm each metric's call sites.
- [ ] Make CI performance and bundle checks required if they are intended to block regressions.
- [ ] Add a production aggregation/telemetry destination only if product requirements call for it; current metrics are local diagnostics, not centralized RUM.

## CI Integration

The existing pipeline is `.github/workflows/performance.yaml`. Performance benchmark and Lighthouse failures are informational; the bundle budget check is blocking through an explicit follow-up step. The following is an example only, not the active workflow:

```yaml
# Example only; active workflow: .github/workflows/performance.yaml
name: Performance Tests

on: [pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install
      - name: Run benchmarks
        run: pnpm vitest bench --reporter=json > bench-results.json
      - name: Compare with baseline
        run: node scripts/compare-benchmarks.js
      - name: Comment on PR
        # Post results as PR comment
```

## Debugging Performance Issues

### Using the Performance Dashboard

1. Enable dev mode
2. Press `Ctrl+Shift+P` to toggle the in-app performance monitor (see `app/components/debug/PerformanceMonitor.tsx`).
4. View live metrics and statistics

### Browser DevTools Integration

The performance monitoring is compatible with Chrome DevTools:

1. Open DevTools → Performance tab
2. Record while using the app
3. Look for custom user timings (your journey names)
4. Correlate with React profiler

### Exporting Data

```typescript
// Export performance data
const data = PerformanceMonitor.exportEvents();
console.log(data); // JSON format

// Get specific journey stats
const chatStats = PerformanceMonitor.getJourneyStats('chat-init');
console.table(chatStats);
```

## Best Practices

### 1. Measure Before Optimizing
Always establish a baseline before making changes:
```typescript
const before = PerformanceMonitor.getJourneyStats('operation');
// ... make optimization
const after = PerformanceMonitor.getJourneyStats('operation');
console.log(`Improvement: ${before.p75 - after.p75}ms`);
```

### 2. Use Web Workers for Heavy Computation
Move expensive operations off the main thread:
- Syntax highlighting ✅
- Large file parsing
- Complex calculations
- Image processing

### 3. Implement Caching Strategically
Cache expensive operations:
```typescript
const cache = new Map();
function expensiveOperation(input) {
  if (cache.has(input)) return cache.get(input);
  const result = /* expensive work */;
  cache.set(input, result);
  return result;
}
```

### 4. Lazy Load Non-Critical Code
```typescript
// Instead of eager import
import { HeavyComponent } from './Heavy';

// Use lazy loading
const HeavyComponent = lazy(() => import('./Heavy'));
```

### 5. Monitor in Production
The app records local performance diagnostics in browser storage. It does not send these events to a production aggregation service. If adding telemetry, define consent, sampling, retention, and privacy requirements first. Example sampling logic only:
```typescript
if (Math.random() < 0.01) { // illustrative 1% sampling; not current app behavior
  PerformanceMonitor.trackJourney(name, duration);
}
```

## Resources

- [Web Vitals Documentation](https://web.dev/vitals/)
- [Shiki Documentation](https://shiki.style/)
- [Vitest Benchmarking](https://vitest.dev/guide/features.html#benchmarking)

## Contributing

When adding new features:

1. **Instrument**: Add performance tracking
2. **Benchmark**: Create lab tests
3. **Budget**: Define acceptable thresholds
4. **Guard**: Add CI checks to prevent regression

## Questions?

Check existing journey statistics:
```typescript
PerformanceMonitor.getJourneyNames().forEach(name => {
  const stats = PerformanceMonitor.getJourneyStats(name);
  console.log(`${name}: ${stats.p75}ms (P75)`);
});
```
