# Performance Guide

Single reference for everything performance related in bolt.diy. Written for both
humans and AI agents working in this repo.

If you touch a hot path, add instrumentation before you optimize it, then keep the
budget honest. See [Workflow](#workflow-for-changes) for the loop.

## Contents

- [Quick start](#quick-start)
- [Commands](#commands)
- [What actually exists](#what-actually-exists)
- [Budgets](#budgets)
- [Monitoring](#monitoring)
  - [Journeys API (`app/lib/performance/metrics.ts`)](#journeys-api-applibperformancemetricsts)
  - [PerformanceMonitor (`app/utils/performance-monitor.ts`)](#performancemonitor-apputilsperformance-monitorts)
  - [Frame rate](#frame-rate)
  - [Console handles](#console-handles)
- [Optimizations](#optimizations)
  - [Static composer](#static-composer)
  - [Prefetching](#prefetching)
  - [Streaming](#streaming)
  - [WebContainer pre-boot](#webcontainer-pre-boot)
  - [CodeMirror](#codemirror)
  - [Worker based syntax highlighting](#worker-based-syntax-highlighting)
  - [React hooks](#react-hooks)
- [Integration recipes](#integration-recipes)
- [Benchmarks](#benchmarks)
- [Debugging](#debugging)
- [Rules of thumb](#rules-of-thumb)
- [Known gaps](#known-gaps)
- [Further reading](#further-reading)

## Quick start

```bash
pnpm run perf:test       # run tests/performance
pnpm run perf:analyze    # bundle sizes vs budgets (needs a build)
pnpm run perf:check      # budget checker
pnpm run perf:report     # perf:test + perf:analyze
```

## Commands

| Command | What it does |
|---|---|
| `pnpm run perf:test` | Runs `vitest --run tests/performance` |
| `pnpm run perf:analyze` | `scripts/analyze-bundle.js`, reads `build/client` |
| `pnpm run perf:check` | `scripts/check-performance-budgets.js` with hardcoded example metrics |
| `pnpm run perf:report` | perf:test followed by perf:analyze |
| `pnpm run benchmarks` | `vitest bench` |
| `pnpm run benchmarks:watch` | `vitest bench --watch` |
| `pnpm run test:integration` | Layout stability and monitoring integration tests |

`perf:analyze` needs `pnpm run build` to have produced `build/client` first.
`pnpm run test:perf` is an alias for `perf:test`.

## What actually exists

Two monitoring systems live in the repo. They are separate and both in use, they do
not replace each other, and their numbers are not comparable.

| System | Location | Style | Consumers |
|---|---|---|---|
| Journeys API | `app/lib/performance/metrics.ts` | Instance + `journeys` helpers | `app/root.tsx`, `StaticComposer` |
| PerformanceMonitor | `app/utils/performance-monitor.ts` | Static class, auto-inits on import | `PerformanceDashboard` |

Supporting modules:

| File | Purpose |
|---|---|
| `app/lib/performance/prefetch.ts` | Prefetch manager, hover and visibility prefetch |
| `app/lib/performance/streaming-optimizer.ts` | Frame budget tracking, block memoization, DOM batching |
| `app/lib/performance/webcontainer-optimizer.ts` | Background WebContainer boot |
| `app/lib/performance/codemirror-optimizer.ts` | Lazy language modes, highlight preprocessing |
| `app/lib/hooks/usePerformanceOptimizedRender.ts` | Render and lazy-loading hooks |
| `app/components/chat/StaticComposer.tsx` | Typeable composer during hydration |
| `app/components/debug/PerformanceDashboard.tsx` | UI view over PerformanceMonitor |
| `app/utils/frame-rate-monitor.ts` | FPS sampling, `useFrameRateMonitor` |
| `app/utils/syntax-highlighter-client.ts` | Shiki off the main thread |
| `app/workers/syntax-highlighter.worker.ts` | The worker itself |
| `.performance-budgets.json` | Budgets with ratchet history |
| `scripts/check-performance-budgets.js` | Budget comparison logic, currently run against example data |
| `scripts/analyze-bundle.js` | Bundle size budgets |
| `.github/workflows/performance.yaml` | perf tests, bundle analysis, Lighthouse, PR comment |
| `tests/performance/` | perf tests and benches |
| `tests/integration/layout-stability.test.tsx` | Layout shift regressions |
| `docs/performance-architecture.md` | Diagrams |

Everything below is exported from `app/lib/performance/index.ts` unless noted.

## Budgets

Source of truth is `.performance-budgets.json`. Budgets only go down.

| Journey | Budget |
|---|---|
| App launch interactive (p75) | 550ms |
| Composer typeable | 100ms |
| Message first token | 300ms |
| Project load | 730ms |
| WebContainer boot | 2000ms |
| Code block render | 100ms |
| Message render | 50ms |
| Terminal init | 150ms |
| Frame budget 60fps | 16.67ms |
| Frame budget 120fps | 8.33ms |
| Max dropped frames | 5% |
| Main bundle | 500KB gzipped |
| Vendor bundle | 300KB gzipped |
| WebContainer API | 200KB |
| CLS / LCP / FID / INP | 0.1 / 2500ms / 100ms / 200ms |

`checkBudget` in `scripts/check-performance-budgets.js` allows 2% tolerance for
measurement noise. Beating a budget by more than 10% is reported as an invitation
to ratchet down. Exceeding it fails.

The script's CLI entry point ignores its own arguments and runs against a hardcoded
example metrics object, so `pnpm run perf:check` is a demo, not a gate. To wire it
up, import `runBudgetCheck` and feed it real values from a test run.

Ratchet procedure:

1. Measure the new value.
2. If it is at least 10% under the current budget, lower the `budget` field.
3. Append a `history` entry with date, value, and a short note.
4. Never raise a budget in the same PR that touched the code it covers.

## Monitoring

### Journeys API (`app/lib/performance/metrics.ts`)

Mark the start and end of a journey. Everything is a no-op outside the browser, so
calling it during SSR is safe.

```typescript
import { journeys } from '~/lib/performance';

journeys.appLaunch.start();
journeys.appLaunch.reactHydrated();
journeys.appLaunch.interactive({ theme: 'dark' });
```

Mechanics, since they bite:

- `markStart(journey, label)` writes a User Timing mark named `<journey>:<label>`
  and stores the timestamp.
- `markEnd(journey, label, metadata)` measures `<journey>:start` to
  `<journey>:<label>`, records the duration as a metric under that same name, then
  clears the start mark. A journey completes once per start. Calling `markEnd`
  without a start logs a warning and returns `null`.
- The intermediate marks (`reactHydrated`, `mounted`, `dataLoaded`, ...) are
  recorded as marks only. They do not produce metrics. Only the `markEnd` label
  becomes a metric, so `getJourneyMetrics('composer')` returns one entry per
  completed journey.
- Metric names are `<journey>:<label>`. `getJourneyMetrics` filters by prefix, so
  `getJourneyMetrics('composer')` catches `composer:typeable` and
  `getMetrics().filter((m) => m.name.startsWith('web-vitals'))` gets the vitals.

Available journeys and their marks:

| Journey | Marks | Ends on |
|---|---|---|
| `appLaunch` | `start`, `htmlParsed`, `reactHydrated` | `interactive(metadata?)` |
| `composer` | `start`, `mounted` | `typeable(metadata?)` |
| `messageSend` | `start(id)`, `requestSent(id)` | `firstToken(id, metadata?)` |
| `projectLoad` | `start(id)`, `dataLoaded(id)` | `rendered(id, metadata?)` |
| `webContainer` | `start`, `apiLoaded` | `booted(metadata?)` |
| `preview` | `start(id)`, `compiled(id)` | `rendered(id, metadata?)` |

The id-taking journeys key their journey name as `message-send-<id>`,
`project-load-<id>`, `preview-<id>`, so look them up by prefix.

`app/root.tsx` already wires `appLaunch` and calls `observeWebVitals()` on mount.
Every other journey is defined but nothing calls it, so those budgets have no data
behind them. Wiring them up is the first thing to do if you care about the numbers.

Ad hoc metrics without a journey:

```typescript
import { performanceMonitor } from '~/lib/performance';

performanceMonitor.recordMetric('my-op', 12.4, { rows: 100 });
performanceMonitor.getMetrics();
performanceMonitor.getJourneyMetrics('composer');
performanceMonitor.calculatePercentiles([1, 2, 3]);
performanceMonitor.clear();
performanceMonitor.generateReport();
```

In dev every recorded metric logs as `[PERF] <name>: <duration>ms`.

In production builds `recordMetric` calls `window.__PERFORMANCE_ANALYTICS__(metric)`
if something has registered it. Nothing registers it by default, so metrics stay
local. To ship them, define that function before the first metric is recorded:

```javascript
window.__PERFORMANCE_ANALYTICS__ = (metric) => {
  analytics.track('performance', {
    name: metric.name,
    duration: metric.duration,
    metadata: metric.metadata,
  });
};
```

`observeWebVitals()` records `web-vitals:cls`, `web-vitals:lcp`, `web-vitals:fid`.
INP has a budget entry but no observer. See [Known gaps](#known-gaps).

### PerformanceMonitor (`app/utils/performance-monitor.ts`)

Static class, auto-inits on import in the browser. Events are kept in memory and
mirrored to `localStorage`. Tracks page load automatically on init.

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

await PerformanceMonitor.measureAsync('chat-init', async () => {
  await initializeChat();
}, { workspaceType: 'react' });

const elapsed = PerformanceMonitor.measureSync('file-switch', () => switchFile(id), { fileId });

PerformanceMonitor.startMeasurement('message-send');
// ...
PerformanceMonitor.endMeasurement('message-send', { messageLength, error: false });

PerformanceMonitor.getJourneyStats('chat-init'); // { count, p50, p75, p95, p99, min, max, avg }
PerformanceMonitor.getJourneyNames();
PerformanceMonitor.getEvents();
PerformanceMonitor.exportEvents();
PerformanceMonitor.clearEvents();
PerformanceMonitor.trackJourney(name, durationMs, metadata);
```

`getJourneyStats` returns `null` for a journey with no events, so null-check before
reading percentiles.

`measureAsync` and `measureSync` both accept metadata. `endMeasurement` should be
called on the error path too, with `{ error: true }`, so failures show up in stats.

On init the monitor records a `page-load` journey from the navigation timing entry.
That name shows up in `getJourneyNames()` alongside anything you track yourself.

`PerformanceMonitor` is not exposed on `window`. Import it in the console or add
the debug menu entry described below.

### Frame rate

```typescript
import { FrameRateMonitor, useFrameRateMonitor } from '~/utils/frame-rate-monitor';

const monitor = new FrameRateMonitor(60, (fps, dropped) => {
  if (fps < 55) console.warn(`${fps}fps`);
});
monitor.start();
// ...
const stats = monitor.getStats();
monitor.stop();

function StreamingMessage() {
  const { fps, droppedFrames, stats } = useFrameRateMonitor(60, true);
}
```

`getStats()` returns `{ currentFps, avgFrameTime, minFrameTime, maxFrameTime,
droppedFrames, budgetCompliance }`. `budgetCompliance` is a percentage.

`app/lib/performance/streaming-optimizer.ts` has its own frame accounting via
`streamingOptimizer.trackFrame(workDurationMs)`. It picks the budget from
`window.screen.refreshRate`, so 8.33ms on a 120Hz display and 16.67ms otherwise.
It keeps the last 240 frames and warns on drops in dev. `getStats()` returns
`{ targetFPS, frameBudget, droppedFrames, averageFrameTime, percentDropped }`.

The two do not share state, so do not mix their numbers.

### Console handles

```javascript
window.__BOLT_PERFORMANCE__.report();
window.__BOLT_PERFORMANCE__.monitor.getMetrics();
window.__BOLT_PERFORMANCE__.monitor.getJourneyMetrics('composer');
window.__BOLT_STREAMING__.getStats();

window.__BOLT_PERFORMANCE__.monitor.getMetrics()
  .filter((m) => m.name.startsWith('web-vitals'));
```

`window.__BOLT_STREAMING__` exposes `getStats` and the `streamingOptimizer`
instance. The prefetch, CodeMirror, and WebContainer helpers are not on `window`.

## Optimizations

### Static composer

Renders a plain textarea into the document before React hydrates, then hands the
value and focus to the React textarea and removes itself. Typeable before
hydration instead of after.

```typescript
import {
  StaticComposer,
  useStaticComposer,
  injectStaticComposer,
  generateStaticComposerHTML,
} from '~/components/chat/StaticComposer';
```

- `generateStaticComposerHTML(placeholder?)` returns the markup string.
- `injectStaticComposer(placeholder?)` appends it to `body`, skipping if a static
  composer is already present.
- `useStaticComposer()` injects on mount and returns `{ isReady, handleReady }`.
  Pass `handleReady` as `StaticComposer`'s `onReady`.
- `StaticComposer` renders the React textarea and performs the handoff in an
  effect. Props: `placeholder`, `onReady`, `className`, `style`.

The handoff only runs if all three are present: the static container, the static
textarea, and the React textarea ref. It copies the value, restores focus and
cursor position, warns in dev when the two positions differ by more than 1px,
records `static-composer-handoff` through `__BOLT_PERFORMANCE__`, then removes the
static container.

DOM contract the handoff depends on: container carries
`data-static-composer="true"`, the textarea has id `static-composer-textarea`.
Change either and the handoff silently does nothing.

The React side ships with hardcoded inline styles and a light-only border. Folding
it into the real composer means restyling it to match the app, which is part of
why it is not wired up yet.

Not wired into the main chat interface yet. See [Known gaps](#known-gaps).

### Prefetching

```typescript
import {
  prefetchManager,
  usePrefetchOnHover,
  prefetchComponent,
  prefetchOnVisible,
} from '~/lib/performance';

const prefetch = usePrefetchOnHover(chatId, () => fetch(`/api/chats/${chatId}`).then(r => r.json()), 50);

<div
  onMouseEnter={prefetch.onMouseEnter}
  onMouseLeave={prefetch.onMouseLeave}
  onClick={() => prefetch.fetch()}
/>;
```

Signature is `usePrefetchOnHover(key, loader, delayMs = 50)`. `key` is the cache
key; pass `null` to disable. The delay avoids firing on cursor sweeps. `onMouseEnter`
schedules the prefetch, `onMouseLeave` cancels it, `fetch()` returns the cached
promise if the prefetch already ran and calls the loader otherwise.

`prefetchManager` is the underlying singleton if the hook shape does not fit:
`prefetch(key, loader, { priority, timeout })`, `get(key, loader)`, `cancel(key)`,
`invalidate(key)`, `clear()`. The cache stores promises, a rejected prefetch is
evicted so it can be retried, and `get` cancels any pending delayed prefetch for
that key before loading.

`prefetchComponent(importFn)` runs the dynamic import inside `requestIdleCallback`,
falling back to a 1ms timeout. `prefetchOnVisible(element, loader, options)`
prefetches when an element scrolls into view via `IntersectionObserver` and returns
a cleanup function.

### Streaming

```typescript
import {
  streamingOptimizer,
  ContentBlockMemoizer,
  BatchedDOMUpdater,
  batchedDOMUpdater,
  throttleToFrame,
  measureRender,
  optimizeForHighlighting,
} from '~/lib/performance';

// Never re-render a block that is already finished
const memoizer = new ContentBlockMemoizer();
const block = memoizer.get(blockId, () => renderBlock(data));
memoizer.invalidate(blockId); // when the source changes
memoizer.has(blockId);
memoizer.size();

// Coalesce DOM writes into one frame
batchedDOMUpdater.schedule(() => updateA());
batchedDOMUpdater.schedule(() => updateB());
batchedDOMUpdater.clear();

// Frame accounting
streamingOptimizer.trackFrame(performance.now() - frameStart);
streamingOptimizer.getStats();
streamingOptimizer.reset();
streamingOptimizer.isWithinBudget(duration);
streamingOptimizer.getRemainingBudget(elapsed);
```

`batchedDOMUpdater` is a singleton `BatchedDOMUpdater`. It drains its queue inside
`requestAnimationFrame`, stops at 80% of the remaining frame budget, records the
flush duration against `streamingOptimizer`, and schedules another frame if work is
left over. `clear()` drops pending updates and cancels the frame.

`throttleToFrame(fn)` wraps a callback so it runs at most once per animation
frame. `measureRender(name, fn)` times `fn` and logs the result.

### WebContainer pre-boot

```typescript
import {
  prebootWebContainer,
  getWebContainer,
  isWebContainerReady,
  resetWebContainer,
  getWebContainerPreconnect,
} from '~/lib/performance';

// Early, fire and forget
prebootWebContainer();

// Later, resolves fast if the boot is already in flight
const container = await getWebContainer();
```

`prebootWebContainer()` dynamically imports `@webcontainer/api` and calls `boot()`
in the background, storing the promise. Calling it again while a boot is in flight
is a no-op. `getWebContainer()` returns the booted instance, or kicks off the boot
and awaits it, so it is safe to call without prebooting.

`app/root.tsx` already calls `prebootWebContainer()` on mount. Add
`getWebContainerPreconnect()` as a `<link rel="preconnect" href="https://unpkg.com">`
if you want the package CDN fetch to start before JS runs.
`resetWebContainer()` clears the cached instance and promise, for tests.

### CodeMirror

```typescript
import {
  createOptimizedExtensions,
  preprocessCodeForHighlighting,
  loadLanguageSupport,
  languageCache,
  detectLanguage,
  optimizedEditorConfig,
  codeMirrorMonitor,
} from '~/lib/performance';

const tsExtension = await languageCache.get('typescript');
const prepared = preprocessCodeForHighlighting(code);
```

`languageCache.get(lang)` returns a CodeMirror `Extension` for the language and
caches the loader promise. Unknown languages resolve to `null`. `loadLanguageSupport`
is the uncached path.

`preprocessCodeForHighlighting` replaces em dashes with `--`, ellipses with `...`,
and any remaining non-Latin-1 character with a space, which keeps V8 on the fast
Latin-1 string path. That is where most of the highlighting win comes from: em
dashes and similar characters in code roughly double highlight time on unmodified
input. The same substitution lives in `optimizeForHighlighting` in
`streaming-optimizer.ts`; `preprocessCodeForHighlighting` just calls it.

`createOptimizedExtensions()` returns viewport and theme extensions.
`optimizedEditorConfig` holds editor tuning values (`updateDelay`,
`maxHighlightLength`, `lineSeparator`, `tabSize`). `detectLanguage(filename)` maps
a filename to a language.

`codeMirrorMonitor` tracks editor operations separately from the journey monitor.

### Worker based syntax highlighting

Shiki blocks the main thread for 50 to 200ms per code block, which drops frames
during streaming. The worker moves that off thread so the UI stays responsive.

```typescript
import { highlightCode, getSyntaxHighlighter } from '~/utils/syntax-highlighter-client';

const html = await highlightCode(code, 'javascript');            // defaults to dark-plus
const light = await highlightCode(code, 'javascript', 'light-plus');
```

`getSyntaxHighlighter()` returns the client if you need more than the helper
(`preload()`, `clearCache()`, `getCacheStats()`).

Behavior worth knowing: results are cached by `language:theme:code` up to 500
entries with oldest-first eviction, requests time out after 5s, and any failure
falls back to plain text rendering rather than throwing. Preloading common
languages is opt-in through `preload()`.

If the worker fails to load, check CSP and confirm the worker is in the build
output.

### React hooks

All from `app/lib/hooks/usePerformanceOptimizedRender.ts`.

| Hook | Signature | Use |
|---|---|---|
| `useStableCallback` | `(callback, deps) => callback` | Stable identity across renders, does not retrigger effects |
| `useThrottledState` | `(initial) => [value, setValue]` | Updates capped at one per frame |
| `useDeepMemo` | `(factory, deps) => value` | Recomputes only when deps actually change |
| `useDebouncedCallback` | `(callback, delay) => [callback, cancel]` | Trailing debounce |
| `useRenderCount` | `(name) => void` | Logs render counts, dev only |
| `useRenderPerformance` | `(name) => void` | Logs slow renders, dev only |
| `useKeepMounted` | `() => { shouldRender, hideInsteadOfUnmount, style }` | Hide with CSS instead of unmounting |
| `useLazyWithPrefetch` | `(importer, shouldPrefetch) => { component, isLoading, error, load }` | Code split with an optional idle prefetch |
| `useVirtualizedList` | `(items, containerHeight, itemHeight, overscan = 3)` | Windowed rendering for long lists |

`useVirtualizedList` returns absolute-positioned items plus a total height for a
scroll container. Use it once message lists get long.

## Integration recipes

### Instrument a journey

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

async function createNewChat() {
  await PerformanceMonitor.measureAsync('chat-init', async () => {
    await initializeWebContainer();
    await setupEditor();
    await setupTerminal();
  }, { workspaceType: 'react' });
}
```

### Track a message end to end

```typescript
import { PerformanceMonitor } from '~/utils/performance-monitor';

async function sendMessage(content: string) {
  PerformanceMonitor.startMeasurement('message-send');

  try {
    const response = await apiClient.sendMessage(content);
    PerformanceMonitor.endMeasurement('message-send', {
      messageLength: content.length,
      hasCode: /```/.test(content),
    });
    return response;
  } catch (error) {
    PerformanceMonitor.endMeasurement('message-send', { error: true });
    throw error;
  }
}
```

### Lazy WebContainer

```typescript
let containerPromise: Promise<WebContainer> | null = null;

function getContainer() {
  containerPromise ??= PerformanceMonitor.measureAsync('webcontainer-boot', () => WebContainer.boot());
  return containerPromise;
}
```

### Add the dashboard

The dashboard lists every journey from `PerformanceMonitor.getJourneyNames()` with
percentiles, tracks live FPS via its own `FrameRateMonitor`, and offers export and
clear. It is not mounted anywhere. A settings tab is the natural home, alongside
`app/components/@settings/tabs/event-logs/EventLogsTab.tsx`. Add the tab type to
`app/components/@settings/core/types.ts` and `app/components/@settings/core/constants.tsx`,
then render the dashboard:

```tsx
import { useEffect, useState } from 'react';
import { PerformanceDashboard } from '~/components/debug/PerformanceDashboard';

function DebugMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button onClick={() => setOpen(true)}>Performance Dashboard</button>
      {open && <PerformanceDashboard onClose={() => setOpen(false)} />}
    </>
  );
}
```

### Keep a component mounted

Unmounting and remounting costs initialization on every toggle. Hide instead.

```tsx
// Avoid
{showChat && <Composer />}

// Prefer
<Composer style={{ display: showChat ? 'block' : 'none' }} />
```

### Batch DOM updates during streaming

```typescript
import { batchedDOMUpdater } from '~/lib/performance';

for (const token of tokens) {
  batchedDOMUpdater.schedule(() => appendToken(token));
}
```

### Measure an existing operation

```typescript
import { measureRender } from '~/lib/performance';

const html = measureRender('highlight', () => highlighter.codeToHtml(code, { lang }));
```

## Benchmarks

There are two groups of files in `tests/performance/` and they run differently.

`*.perf.test.ts(x)` are real Vitest tests and run under `pnpm run perf:test`
(4 files, 26 tests, all passing).

`*.bench.ts` are reference implementations written as plain `describe`/`it` with
`performance.now()` timing, not the Vitest `bench()` API. They are picked up by
`pnpm run benchmarks` only, not by `perf:test`.

perf:test files:

| File | Covers |
|---|---|
| `core-journeys.perf.test.tsx` | Core journey budgets |
| `chat-input.perf.test.ts` | Typing latency, re-renders, submission |
| `streaming-performance.perf.test.tsx` | Frame rate, throttling, long messages |
| `syntax-highlighting.perf.test.ts` | Shiki cost, incremental highlighting, cache |

benchmarks files:

| File | Covers |
|---|---|
| `message-rendering.bench.ts` | List rendering, filtering, sorting, tree building |
| `string-operations.bench.ts` | V8 string paths, concatenation, regex, tokenizing |
| `data-structures.bench.ts` | Array vs Set vs Map, memoization |
| `simple.bench.ts` | Array method baseline |

Writing a new one:

```typescript
import { describe, expect, it } from 'vitest';

describe('My benchmark', () => {
  it('should measure operation speed', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // operation under test
    }

    const avg = (performance.now() - start) / iterations;
    console.log(`Average: ${avg.toFixed(4)}ms per operation`);

    expect(avg).toBeLessThan(1);
  });
});
```

Keep assertions loose. These benches time wall-clock work, so a tight threshold
becomes a flaky CI failure with no real signal. `perf:test` is informational plus
smoke coverage; the gates that actually block are CI bundle analysis and, once
wired up, the budget checker.

Reading the numbers:

- Run more than once. First run is cold.
- 2x is a real difference, 5% is noise.
- Lab results do not predict production. Confirm with the journey monitor.
- Micro-optimizations only matter in hot paths.

What the existing benches found, worth keeping in mind:

- Non-Latin-1 characters in hot string paths push V8 onto the two-byte path. Em
  dashes in code roughly double highlighting time. `optimizeForHighlighting` and
  `preprocessCodeForHighlighting` exist because of this.
- `array.join()` beats repeated `+` for many concatenations.
- `.includes()` beats regex for simple substring checks.
- `Set` and `Map` beat `Array.includes` for lookups by a wide margin at 1000 items.
- `JSON.parse(JSON.stringify(x))` is expensive enough to avoid in render paths.
- Memoize finished streaming blocks, virtualize long lists, batch DOM writes.

Re-measure any of these before relying on them. They came from one run on one
machine and the numbers will not transfer.

## Debugging

Chrome DevTools, Performance tab:

1. Record while reproducing.
2. Look for long tasks over 50ms, layout shifts, forced reflows, heavy script
   execution.

React DevTools Profiler:

1. Profiler tab, record.
2. Reproduce.
3. Sort by duration, anything over 16ms is a dropped frame at 60fps.

Console:

```javascript
window.__BOLT_PERFORMANCE__.report();     // p50/p75/p95/p99 per journey
window.__BOLT_STREAMING__.getStats();     // frame budget usage
```

Layout shifts have regression coverage in `tests/integration/layout-stability.test.tsx`:
composer on mount and on data load, sidebar rows and header on load, scrollbar
appearance, streaming not moving previous messages, code block reveal, and the
Chrome new-tab prerender resize case. Run with `pnpm run test:integration`.

## Workflow for changes

1. Pick a journey and confirm the budget in `.performance-budgets.json`.
2. Instrument it if it is not already covered.
3. Record p50, p75, p95 as the baseline.
4. Profile and find the actual bottleneck.
5. Optimize.
6. Re-measure.
7. If you are at least 10% under the budget, ratchet it down with a history entry.
8. Add or update the bench if the change is not covered by one.

For a new feature, the minimum is: instrumentation on the critical path, a
budget, and a test that would fail if the budget broke.

## Rules of thumb

- Measure first. Anything you can count you can improve.
- Prefer hiding over unmounting in UI that toggles.
- Move CPU work off the main thread (workers) or into idle time
  (`requestIdleCallback`).
- Lazy load anything the first screen does not need.
- Virtualize lists past roughly 50 items.
- Keep hot string content Latin-1 where you can.
- Never raise a budget to make CI pass.

## Known gaps

- Budgets in `.performance-budgets.json` are Claude.dev derived numbers carried
  over, not measurements from this app. Every `history` entry is the same
  "Initial baseline" from 2024-01-01. Real p75 data has never been collected, so
  the budgets are aspirational.
- Static composer is built but no component imports it. Only
  `app/components/chat/StaticComposer.tsx` itself references it.
- `PerformanceDashboard` is built but not reachable from the UI.
- Worker based highlighting exists but no caller uses it. `Artifact.tsx`,
  `CodeBlock.tsx`, `Markdown.tsx`, `ToolInvocations.tsx`, and `DiffView.tsx` all
  import Shiki directly, so the main thread is still doing the highlighting.
- `INP` has a budget but no `PerformanceObserver`. Only CLS, LCP, and FID are
  observed.
- Terminal output is not throttled. `terminal-init` has a 150ms budget and nothing
  measures it.
- `.bench.ts` files run only under `pnpm run benchmarks`. One currently fails on
  a wall-clock assertion in `message-rendering.bench.ts` ("should process message
  content efficiently") that is timing dependent.
- `pnpm run perf:check` runs example metrics, so the ratchet is not enforced
  anywhere. The CI job it feeds also marks perf tests `continue-on-error` and only
  fails on bundle analysis.

## Further reading

- [Claude.dev on how they got 3x](https://claude.dev/blog/how-we-made-claude-ai-faster/)
  Source of the ratchet idea and the budget numbers. Those numbers are a reference
  point, not a result measured in this app.
- [Web Vitals](https://web.dev/vitals/)
- [React render and commit profiling](https://react.dev/learn/render-and-commit)
- [Chrome DevTools performance](https://developer.chrome.com/docs/devtools/performance/)
- [V8 string elements kinds](https://v8.dev/blog/elements-kinds)
- [Shiki](https://shiki.style/)