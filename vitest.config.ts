/**
 * Dedicated Vitest configuration.
 *
 * Lives apart from vite.config.ts so the test runner does not load the
 * application build (Cloudflare plugin, React Router plugin, UnoCSS, the
 * browser-polyfill transform). Those are guarded by `config.mode !== 'test'`
 * today, which works, but couples the test environment to the build graph — a
 * new plugin added for the app can change how tests run.
 *
 * Two projects, because one environment cannot fit this suite:
 *
 * - **node** — pure logic: diffing, path handling, parsers, schema validation,
 *   security helpers, the server-side API modules. No DOM is constructed, which
 *   is both faster and a real assertion: if one of these tests reaches for
 *   `window`, it now fails instead of silently passing under jsdom.
 * - **dom** — anything rendering React or touching `localStorage`,
 *   `window.history`, `indexedDB` or the Worker API.
 *
 * Assignment is by explicit glob, not by sniffing imports, so adding a test
 * never silently changes its environment. `DOM_TESTS` below is the complete
 * list of files that genuinely need a DOM; everything else runs in node. If a
 * node test starts failing on a missing global, that is the signal to move it
 * into DOM_TESTS rather than to widen the node setup.
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Tests that need a DOM.
 *
 * Every entry was verified to fail under `environment: 'node'`, either because
 * it renders with Testing Library or because it reads `window`,
 * `document`, `localStorage`, `indexedDB`, or constructs a Worker.
 */
const DOM_TESTS = [
  // React rendering
  'app/routes.spec.tsx',
  'app/components/chat/Artifact.spec.tsx',
  'app/components/workbench/WorkbenchReopenButton.spec.tsx',
  'app/lib/hooks/useMessageParser.spec.ts',
  'app/lib/persistence/useChatHistory.spec.tsx',

  // Browser storage / globals
  'app/lib/api/cookies.spec.ts',
  'app/lib/persistence/chatCache.spec.ts',
  'app/lib/services/importExportService.spec.ts',
  'app/lib/stores/workbench.spec.ts',

  /*
   * tests/ — every suite here is UI-facing.
   *
   * Listed file by file rather than as `tests/unit/**` etc. An earlier version
   * used directory globs, and they were silently dropped: the `dom` project's
   * `include` needs concrete paths, and a `**` pattern that matches nothing
   * fails open. That quietly cut 11 files and 116 tests from the run while the
   * suite still reported green — the exact failure mode this config is meant to
   * prevent. `tests/setup-dom.spec.ts` below asserts the count instead.
   */
  'tests/integration/layout-stability.test.tsx',
  'tests/integration/performance-monitoring.test.ts',
  'tests/performance/chat-input.perf.test.ts',
  'tests/performance/core-journeys.perf.test.tsx',
  'tests/performance/streaming-performance.perf.test.tsx',
  'tests/performance/syntax-highlighting.perf.test.ts',
  'tests/unit/frame-rate-monitor.test.ts',
  'tests/unit/performance-monitor.test.ts',
  'tests/unit/starter-template-import.test.tsx',
  'tests/unit/StaticComposer.test.tsx',
  'tests/unit/syntax-highlighter-client.test.ts',
];

/**
 * Shared excludes.
 *
 * `Markdown.spec.ts` and `workbench.spec.ts` pull in `import.meta.hot`, which
 * only the app config defines (`import.meta.hot: 'undefined'`). They are listed
 * in DOM_TESTS-adjacent positions but excluded here for both projects, matching
 * the previous behaviour exactly.
 */
const EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
  '**/tests/preview/**', // Exclude preview tests that require Playwright
  '**/tests/e2e/**', // Exclude e2e tests that require Playwright
  'app/components/chat/Markdown.spec.ts', // Exclude - imports cause issues with import.meta.hot
  'app/lib/stores/workbench.spec.ts', // Exclude - imports cause issues with import.meta.hot
];

const SHARED = {
  globals: true,
  setupFiles: ['./tests/setup-base.ts'],
  exclude: EXCLUDE,
  define: {
    'import.meta.hot': 'undefined',
  },
};

const ALIAS = { '~': fileURLToPath(new URL('./app', import.meta.url)) };

export const NODE_PROJECT = {
  ...SHARED,
  name: 'node',
  environment: 'node',
  include: [
    '**/*.{test,spec}.{ts,tsx,js,jsx}',
    '**/tests/unit/**/*.{test,spec}.{ts,tsx,js,jsx}',
    '**/tests/integration/**/*.{test,spec}.{ts,tsx,js,jsx}',
    '**/tests/performance/**/*.perf.test.{ts,tsx,js,jsx}',
  ],
  /*
   * Invert the DOM list. Vitest's `exclude` wins over `include`, so subtracting
   * here is what keeps `DOM_TESTS` out of this project.
   *
   * `.tsx` files are still included: several are pure-logic tests that only
   * happen to use JSX syntax, and forcing them into jsdom for the extension
   * alone would preserve the status quo this config exists to fix.
   */
  exclude: [...EXCLUDE, ...DOM_TESTS],
  benchmark: {
    include: ['**/*.bench.{ts,tsx,js,jsx}', '**/tests/performance/**/*.bench.{ts,tsx,js,jsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};

export const DOM_PROJECT = {
  ...SHARED,
  name: 'dom',
  environment: 'jsdom',
  setupFiles: ['./tests/setup-base.ts', './tests/setup-dom.ts'],
  include: DOM_TESTS,
  exclude: EXCLUDE,
};

/** Excluded by both projects, matching the previous behaviour exactly. */
export const SHARED_EXCLUDE = EXCLUDE;

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias: ALIAS }, test: NODE_PROJECT },
      { resolve: { alias: ALIAS }, test: DOM_PROJECT },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        '**/*.d.ts',
      ],
    },
  },
});
