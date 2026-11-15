/**
 * DOM test setup.
 *
 * Kept as a thin re-export so this path keeps working for anything still
 * pointing at it (notably the `dom` Vitest project and anything running a
 * single file against the app config). The content was split so that pure
 * logic tests can run without a DOM:
 *
 * - `tests/setup-base.ts` — matchers and mock resets. No DOM references, so it
 *   loads in both the `node` and `dom` projects.
 * - `tests/setup-dom.ts` — RTL cleanup, matchMedia, Worker, rAF, performance,
 *   localStorage, PerformanceObserver, web-vitals. All of it touches `window` or
 *   `document`.
 *
 * This file is DOM-only and must not be used by the `node` project.
 */

import './setup-base';
import './setup-dom';
