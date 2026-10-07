# Performance Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Interaction Layer                       │
│  (App Launch, Composer, Messages, Navigation, Streaming)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Performance Monitoring                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Metrics    │  │   Journeys   │  │ Web Vitals   │         │
│  │   System     │  │   Tracking   │  │  Observer    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Optimization Layers                           │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐│
│  │ Static Composer  │  │   Prefetching    │  │   Streaming   ││
│  │   (Instant UX)   │  │ (Hover → Load)   │  │ (60/120 fps)  ││
│  └──────────────────┘  └──────────────────┘  └───────────────┘│
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐│
│  │  WebContainer    │  │   CodeMirror     │  │   React       ││
│  │   Pre-boot       │  │   Lazy Load      │  │  Optimized    ││
│  └──────────────────┘  └──────────────────┘  └───────────────┘│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Quality Gates (CI)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Performance  │  │    Bundle    │  │   Layout     │         │
│  │   Budgets    │  │   Analysis   │  │  Stability   │         │
│  │  (Ratchets)  │  │              │  │    Tests     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Production Analytics                          │
│         (Real User Monitoring + Performance Reports)             │
└─────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

### 1. App Launch Journey

```
User opens app
     │
     ▼
┌─────────────────┐
│ HTML Parsed     │ ◄─── Static Composer injected here
│ (journeys.      │
│  appLaunch.     │
│  start)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ React Hydration │ ◄─── WebContainer pre-boot starts
│ (journeys.      │
│  appLaunch.     │
│  reactHydrated) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Interactive     │ ◄─── User can now interact
│ (journeys.      │      Performance metric recorded
│  appLaunch.     │
│  interactive)   │
└─────────────────┘
```

### 2. Message Streaming Journey

```
User sends message
     │
     ▼
┌─────────────────────┐
│ Message sent        │
│ (journeys.          │
│  messageSend.start) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ First token arrives │ ◄─── Start frame tracking
│ (journeys.          │
│  messageSend.       │
│  firstToken)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Streaming optimization               │
│ ┌─────────────┐  ┌────────────────┐│
│ │ Memoize     │  │ Batch DOM      ││
│ │ finished    │  │ updates        ││
│ │ blocks      │  │                ││
│ └─────────────┘  └────────────────┘│
│                                      │
│ ┌─────────────┐  ┌────────────────┐│
│ │ Track frame │  │ Stay within    ││
│ │ budget      │  │ 16.67ms        ││
│ └─────────────┘  └────────────────┘│
└─────────────────────────────────────┘
```

### 3. Prefetch on Hover Flow

```
User hovers over link
     │
     ▼
┌─────────────────────┐
│ onMouseEnter        │
│ (50ms delay)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ prefetchManager     │ ◄─── Start loading in background
│ .prefetch()         │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌─────────┐
│ Still   │  │ Mouse   │
│ loading │  │ leave   │
└────┬────┘  └────┬────┘
     │            │
     │            ▼
     │      ┌─────────┐
     │      │ Cancel  │
     │      │ prefetch│
     │      └─────────┘
     │
     ▼
┌─────────────────────┐
│ User clicks         │ ◄─── Data already loaded!
│ prefetch.fetch()    │      Instant navigation
└─────────────────────┘
```

## Data Flow

### Performance Metrics Pipeline

```
┌─────────────┐
│   User      │
│  Actions    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────┐
│  Journey Markers         │
│  performance.mark(...)   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  performanceMonitor      │
│  .recordMetric()         │
└──────────┬───────────────┘
           │
           ├───────────────────┐
           │                   │
           ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│  Development     │  │  Production      │
│  console.log()   │  │  Analytics       │
└──────────────────┘  └──────────────────┘
```

### CI Budget Enforcement

```
┌──────────────────┐
│   Pull Request   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  CI Workflow     │
│  Triggers        │
└────────┬─────────┘
         │
         ├─────────────────┬──────────────────┐
         │                 │                  │
         ▼                 ▼                  ▼
┌────────────────┐ ┌──────────────┐ ┌────────────────┐
│ Performance    │ │ Bundle       │ │ Layout         │
│ Tests          │ │ Analysis     │ │ Stability      │
└────────┬───────┘ └──────┬───────┘ └────────┬───────┘
         │                │                   │
         └────────────────┼───────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │ Check vs Budgets     │
              │ (.performance-       │
              │  budgets.json)       │
              └──────────┬───────────┘
                         │
                    ┌────┴────┐
                    │         │
                    ▼         ▼
              ┌─────────┐ ┌─────────┐
              │  Pass   │ │  Fail   │
              │  Merge  │ │  Block  │
              └─────────┘ └─────────┘
```

## Optimization Decision Tree

```
                    Performance Issue?
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    App Launch       Streaming         Navigation
      Slow?            Janky?             Slow?
          │                │                │
          ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ Static  │      │ Frame   │      │ Prefetch│
    │Composer │      │ Budget  │      │ on Hover│
    └─────────┘      └─────────┘      └─────────┘
          │                │                │
          ▼                ▼                ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ Preboot │      │ Memoize │      │ Lazy    │
    │WebContnr│      │ Blocks  │      │ Load    │
    └─────────┘      └─────────┘      └─────────┘
```

## File Organization

```
bolt.diy/
│
├── app/lib/performance/          ← Core performance system
│   ├── metrics.ts                ← Journey tracking
│   ├── prefetch.ts               ← Prefetch manager
│   ├── streaming-optimizer.ts    ← Frame rate optimization
│   ├── webcontainer-optimizer.ts ← Pre-boot logic
│   ├── codemirror-optimizer.ts   ← Editor optimization
│   └── index.ts                  ← Exports
│
├── app/lib/hooks/
│   └── usePerformanceOptimizedRender.ts ← React hooks
│
├── app/components/chat/
│   └── StaticComposer.tsx        ← Instant typing
│
├── tests/performance/            ← Benchmarks
│   ├── core-journeys.perf.test.ts
│   └── streaming-performance.perf.test.ts
│
├── tests/integration/            ← Layout tests
│   └── layout-stability.test.ts
│
├── scripts/
│   ├── check-performance-budgets.js  ← CI enforcement
│   └── analyze-bundle.js             ← Bundle checking
│
├── .github/workflows/
│   └── performance.yaml          ← CI automation
│
├── .performance-budgets.json     ← Ratcheting budgets
│
└── docs/
    ├── PERFORMANCE.md            ← Full guide
    ├── PERFORMANCE_QUICK_START.md
    └── performance-architecture.md ← This file
```

## Key Metrics Dashboard (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│              bolt.diy Performance Dashboard                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  App Launch (p75)         [████████░░] 550ms / 550ms ✓     │
│  Composer Typeable        [█████░░░░░]  95ms / 100ms ✓     │
│  Message First Token      [████████░░] 280ms / 300ms ✓     │
│  Project Load             [███████░░░] 720ms / 730ms ✓     │
│  WebContainer Boot        [█████░░░░░] 1.8s  / 2.0s  ✓     │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Streaming Performance                                        │
│                                                               │
│  Frame Rate: 59.2 fps  (Target: 60 fps)                     │
│  Dropped Frames: 2.3%  (Budget: < 5%)                       │
│  Avg Frame Time: 15.8ms (Budget: 16.67ms)                   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  Web Vitals                                                   │
│                                                               │
│  CLS: 0.08  ✓  (Budget: < 0.1)                              │
│  LCP: 2.1s  ✓  (Budget: < 2.5s)                             │
│  FID: 85ms  ✓  (Budget: < 100ms)                            │
│  INP: 180ms ✓  (Budget: < 200ms)                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Application Code
```typescript
import { journeys } from '~/lib/performance';

// Your feature code here
journeys.yourFeature.start();
// ... work ...
journeys.yourFeature.complete();
```

### 2. Component Level
```typescript
import { usePrefetchOnHover, useStableCallback } from '~/lib/performance';

// In your React components
const prefetch = usePrefetchOnHover(...);
const stableCallback = useStableCallback(...);
```

### 3. CI/CD Pipeline
```yaml
# .github/workflows/performance.yaml
- run: pnpm run perf:test
- run: pnpm run perf:analyze
```

### 4. Console (Production)
```javascript
// Available globally
window.__BOLT_PERFORMANCE__.report()
window.__BOLT_STREAMING__.getStats()
```

## Measurement Philosophy

```
     Instrument
         │
         ▼
     Measure
         │
         ▼
    Establish
     Budget
         │
         ▼
    Optimize
         │
         ▼
     Validate
         │
         ▼
   Ratchet Down
     Budget
         │
         └──┐
            │
            ▼
         Repeat
```

## Success Criteria

1. ✅ All core journeys instrumented
2. ✅ Budgets established and enforced in CI
3. ✅ <5% frame drops during streaming
4. ✅ No layout shifts > 0.1 CLS
5. ✅ Bundle sizes tracked and controlled
6. ✅ Continuous monitoring in production

---

This architecture enables continuous performance improvement through measurement, optimization, and enforcement.
