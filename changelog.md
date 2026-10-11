# Since version 1.0.0

## What's Changed 🌟

### ⚙️ Configuration

* update Cloudflare Workers compatibility date to 2026-10-01

### ✨ Features

* add Simple Sal, Tiny Tim, and DiligentDan options to the Prompt Library, including prompts optimized for smaller models (91bb67a, 4a6181e, a3d6483)
* add a blank starter flow and framework starter setup that opens the project without an initial generation request (5397ce4, e4af3b0)
* move MCP tool selection into the prompt attachment menu and show connector connection status there (2ea9f30, e49c8d5)
* regroup settings navigation and combine service integrations in the Connectors tab (ca935e8, 78d6b7e)
* restore all 22 cloud and local AI providers (9ca2a34) by @dustinwloring1988
* preserve user-selected workbench tab, lazy-mount diff and preview panels, and inject prompt workstyle commentary instructions ([#2217](https://github.com/stackblitz-labs/bolt.diy/pull/2217)) by @dustinwloring1988
* update model catalogs, context windows, and token limits across all supported LLM providers ([#2216](https://github.com/stackblitz-labs/bolt.diy/pull/2216)) by @dustinwloring1988
* add persistent sidebar trigger toggle button when sidebar is collapsed ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* upgrade the AI SDK from v4 to v7 ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (853bd2a) by @dustinwloring1988
* write both message shapes at the v4 call sites ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (85b0cc1) by @dustinwloring1988
* add dual-shape message accessors for the v4 to v5 migration ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (f4b3143) by @dustinwloring1988
* add AI SDK v4 to v5+ message migration module ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (b47f528) by @dustinwloring1988
* enable Anthropic, OpenAI and Google alongside OpenRouter ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (f3c2b5e) by @dustinwloring1988
* update core stack React 19 / Vite 8 / TS 7 ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (2f1e20d) by @dustinwloring1988

### 🐛 Bug Fixes

* preserve workbench access when starting a project and fix blank starter creation (6358436, 5397ce4)
* handle tool calls emitted as assistant text and fix route configuration startup crashes (acf91f9, bf0ce1b)
* improve terminal drawer behavior and light/dark theme styling (1618553)
* make the redesigned settings panel fit the viewport and improve navigation (2c3b77d, ca935e8)
* resolve race condition when switching between chats (90d1912) by @dustinwloring1988
* update GitHub fine-grained token URL from /beta to /personal-access-tokens/new (e6d0c9a) by @chen-jiying
* update LLM manager tests to reflect all 22 enabled providers (963f6d4) by @dustinwloring1988
* update Clone a repo button to have single icon in front of text (223e3b1) by @dustinwloring1988
* quiet missing API key errors on startup for unconfigured LLM providers ([#2215](https://github.com/stackblitz-labs/bolt.diy/pull/2215)) by @dustinwloring1988
* resolve tsconfig paths natively, silence dotenv dev noise, and disable remote Cloudflare Request.cf fetch during local dev ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* add peerDependencyRules to silence safe version mismatches on pnpm install ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* restore native anchor reload for logo and new chat navigation ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* resolve process.cwd is not a function error in file actions ([#2211](https://github.com/stackblitz-labs/bolt.diy/pull/2211)) (31aff28) by @dustinwloring1988
* stop losing message fields on import/export, typecheck two chat files ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (1bf219d) by @dustinwloring1988
* repair the electron build scripts, which could not run ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (951b2dd) by @dustinwloring1988
* move wrangler to dependencies so the production image can start ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (6ef0f60) by @dustinwloring1988
* restore typecheck and lint on the merged React 19 / Vite 8 stack ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (035364a) by @dustinwloring1988

### ⚡ Performance Improvements

* on-demand lazy mounting of DiffView and Preview panels in Workbench to reduce initial render overhead ([#2217](https://github.com/stackblitz-labs/bolt.diy/pull/2217)) by @dustinwloring1988
* eliminate mid-load dependency re-bundling screen flashes via comprehensive optimizeDeps pre-bundling, and lazy-load Workbench on landing page ([#2215](https://github.com/stackblitz-labs/bolt.diy/pull/2215)) by @dustinwloring1988
* chat mount preservation across navigation, hover prefetching into in-memory cache, deferred Shiki syntax highlighting during streaming, and memoized frozen markdown blocks ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* easy performance wins and TDD improvements: reduce unnecessary renders and lazy-load workbench views ([#2212](https://github.com/stackblitz-labs/bolt.diy/pull/2212)) (972059e) by @dustinwloring1988

### ♻️ Code Refactoring

* read presentation components through the dual-shape accessors ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (bc984d9) by @dustinwloring1988
* make persistence reads shape-agnostic, drop dead ChatMessage ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (4228bdf) by @dustinwloring1988
* read message data through the dual-shape accessors ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (2fe4e7e) by @dustinwloring1988

### 🧪 Tests

* wrap state updates in act() to fix React warnings (4e6479b) by @dustinwloring1988
* add comprehensive tests for chat switching race condition fix (b3ee2a1) by @dustinwloring1988
* add unit tests for prompt workstyle guidance and workbench view selection retention ([#2217](https://github.com/stackblitz-labs/bolt.diy/pull/2217)) by @dustinwloring1988
* add unit tests for in-memory chat cache and prefetching layer ([#2214](https://github.com/stackblitz-labs/bolt.diy/pull/2214)) by @dustinwloring1988
* pin the OpenAI provider wire format before the SDK upgrade ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210)) (0cc227f) by @dustinwloring1988
* add migration safety harness (stream protocol, llm utils, mcp tools, e2e persistence) and extract reasoning rewrite transform ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (cd755e9) by @dustinwloring1988

### ⚙️ CI

* fix Quality Gates check timing issue (ad6dfd1) by @dustinwloring1988
* remove hardcoded pnpm version from security and test workflows ([#2211](https://github.com/stackblitz-labs/bolt.diy/pull/2211)) (e3003b8) by @dustinwloring1988
* replace deleted cloudflare/pages-action with wrangler-action ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (7a7264b) by @dustinwloring1988
* bump Node to 22 so Vite 8 gets its rolldown native binding, add .gitattributes ([#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) (923bec3) by @dustinwloring1988

### 🔍 Other Changes

* streamline README structure, eliminate redundant setup instructions, and link directly to FAQ & troubleshooting documentation by @dustinwloring1988
* modernize dependencies and frameworks: migrate to React Router v7, Remix 2.17, Zod 4, Electron 44.5.1, Shiki v4, and update WebContainer API ([#2211](https://github.com/stackblitz-labs/bolt.diy/pull/2211), [#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210), [#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) by @dustinwloring1988
* broad dependency updates and cleanup across UI and runtime libraries (framer-motion, date-fns, lucide-react, xterm, octokit, pnpm 12) ([#2211](https://github.com/stackblitz-labs/bolt.diy/pull/2211), [#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) by @dustinwloring1988
* developer tooling and configuration enhancements: add benchmark scripts, adjust OpenRouter completion limits, and remove stale type stubs ([#2210](https://github.com/stackblitz-labs/bolt.diy/pull/2210), [#2209](https://github.com/stackblitz-labs/bolt.diy/pull/2209)) by @dustinwloring1988

---

# 🚀 Release v1.0.0

## What's Changed 🌟

### 🔄 Changes since v0.0.7

### ✨ Features

* restoring project from snapshot on reload ([#444](https://github.com/stackblitz-labs/bolt.diy/pull/444)) by @thecodacus
* add Claude 3.7 Sonnet model as static list and update API key reference ([#1449](https://github.com/stackblitz-labs/bolt.diy/pull/1449)) by @BurhanCantCode
* electron desktop app without express server ([#1136](https://github.com/stackblitz-labs/bolt.diy/pull/1136)) by @Derek-X-Wang
* supabase integration #1542 from xKevIsDev/supabase (1364d4a) by @leex279
* bugfix for : Problem Temporarily Solved, Not Fix: Error building my application #1414 ([#1567](https://github.com/stackblitz-labs/bolt.diy/pull/1567)) by @Stijnus
* bolt dyi datatab ([#1570](https://github.com/stackblitz-labs/bolt.diy/pull/1570)) by @Stijnus
* bolt dyi preview final ([#1569](https://github.com/stackblitz-labs/bolt.diy/pull/1569)) by @Stijnus
* new improvement for the GitHub API Authentication Fix  ([#1537](https://github.com/stackblitz-labs/bolt.diy/pull/1537)) by @Stijnus
* rework Task Manager Real Data ([#1483](https://github.com/stackblitz-labs/bolt.diy/pull/1483)) by @Stijnus
* add Vercel integration for project deployment ([#1559](https://github.com/stackblitz-labs/bolt.diy/pull/1559)) by @xKevIsDev
* bulk delete chats from sidebar ([#1586](https://github.com/stackblitz-labs/bolt.diy/pull/1586)) by @Stijnus
* consolidate sync & export items into an overflow menu ([#1602](https://github.com/stackblitz-labs/bolt.diy/pull/1602)) by @kochrt
* update connectiontab and datatab security fix ([#1614](https://github.com/stackblitz-labs/bolt.diy/pull/1614)) by @Stijnus
* fix for push private repo ([#1618](https://github.com/stackblitz-labs/bolt.diy/pull/1618)) by @Stijnus
* add expo app creation, enhance ui, and refactor code ([#1651](https://github.com/stackblitz-labs/bolt.diy/pull/1651)) by @xKevIsDev
* implement a search functionality to search codebase ([#1676](https://github.com/stackblitz-labs/bolt.diy/pull/1676)) by @xKevIsDev
* lock files ([#1681](https://github.com/stackblitz-labs/bolt.diy/pull/1681)) by @Stijnus
* github fix and ui improvements ([#1685](https://github.com/stackblitz-labs/bolt.diy/pull/1685)) by @Stijnus


### 🐛 Bug Fixes

* handle empty content correctly in FilesStore saveFile() ([#1381](https://github.com/stackblitz-labs/bolt.diy/pull/1381)) by @bizrockman
* OpenAILike api key not showing up ([#1403](https://github.com/stackblitz-labs/bolt.diy/pull/1403)) by @thecodacus
* git connection fix for starter template ([#1411](https://github.com/stackblitz-labs/bolt.diy/pull/1411)) by @thecodacus
* support php language in diff view (b018742) by @xKevIsDev
* added a bunch more common languages to diff view (964e197) by @xKevIsDev
* git clone modal to work with non main as default branch ([#1428](https://github.com/stackblitz-labs/bolt.diy/pull/1428)) by @thecodacus
* git cookies are auto set anytime connects changed or loaded ([#1461](https://github.com/stackblitz-labs/bolt.diy/pull/1461)) by @thecodacus
* fix git proxy to work with other git provider ([#1466](https://github.com/stackblitz-labs/bolt.diy/pull/1466)) by @thecodacus
* attachment not getting sent on first message if starter template is turned on ([#1472](https://github.com/stackblitz-labs/bolt.diy/pull/1472)) by @thecodacus
* settings bugfix error building my application  issue #1414 ([#1436](https://github.com/stackblitz-labs/bolt.diy/pull/1436)) by @Stijnus
* update stream-text.ts ([#1582](https://github.com/stackblitz-labs/bolt.diy/pull/1582)) by @Stijnus
* whitelist vue and svelte files ([#1598](https://github.com/stackblitz-labs/bolt.diy/pull/1598)) by @kochrt
* simplify the SHA-1 hash function in netlify deploy by using the crypto module directly ([#1590](https://github.com/stackblitz-labs/bolt.diy/pull/1590)) by @xKevIsDev
* fix load server build problem by fix dep version ([#1625](https://github.com/stackblitz-labs/bolt.diy/pull/1625)) by @Derek-X-Wang
* optimize file watch paths for preview updates and fix npm crashes ([#1644](https://github.com/stackblitz-labs/bolt.diy/pull/1644)) by @xKevIsDev
* make diff button consistent with other toolbar buttons ([#1601](https://github.com/stackblitz-labs/bolt.diy/pull/1601)) by @kochrt
* invalid line number error in search functionality ([#1682](https://github.com/stackblitz-labs/bolt.diy/pull/1682)) by @Stijnus
* fix icon classes for consistency and clarity #release:major (870828d) by @xKevIsDev
* fix icon classes for consistency and clarity #release:major (6e9a1b6) by @xKevIsDev
* icon classes to existing icons #release:major (e9df523) by @xKevIsDev
* revert back to previous commit (553fa5d) by @xKevIsDev


### 📚 Documentation

* docs README.md changes (Webcontainer liicensing for commercial, other small things) (88901f3) by @leex279


### ♻️ Code Refactoring

* remove success toast and prioritize public domain URL ([#1613](https://github.com/stackblitz-labs/bolt.diy/pull/1613)) by @xKevIsDev
* optimize error handling and npm install performance ([#1688](https://github.com/stackblitz-labs/bolt.diy/pull/1688)) by @xKevIsDev


### ⚙️ CI

* updated target for docker build ([#1451](https://github.com/stackblitz-labs/bolt.diy/pull/1451)) by @thecodacus
* give electron action permission ([#1549](https://github.com/stackblitz-labs/bolt.diy/pull/1549)) by @Derek-X-Wang
* only draft release for branch build ([#1577](https://github.com/stackblitz-labs/bolt.diy/pull/1577)) by @Derek-X-Wang
* remove macOS code signing credentials from workflow ([#1677](https://github.com/stackblitz-labs/bolt.diy/pull/1677)) by @xKevIsDev
* add Electron build process to release workflow (73442dd) by @xKevIsDev
* reorder steps and add env vars for Electron build #release:major (a76013f) by @xKevIsDev


### 🔍 Other Changes

* Delete wrangler.toml (60b6f47) by @leex279
* Delete .tool-versions (2780b2e) by @leex279
* Revert "Delete wrangler.toml" (8d1f138) by @thecodacus
* Merge branch 'docker-fix' (5528306) by @thecodacus
* fix icon classes for consistency and clarity #release:major" (4354ad4) by @xKevIsDev
* fix icon classes for consistency and clarity #release:major" (5630be7) by @xKevIsDev


## ✨ First-time Contributors

A huge thank you to our amazing new contributors! Your first contribution marks the start of an exciting journey! 🌟

* 🌟 [@BurhanCantCode](https://github.com/BurhanCantCode)
* 🌟 [@Derek-X-Wang](https://github.com/Derek-X-Wang)
* 🌟 [@bizrockman](https://github.com/bizrockman)

## 📈 Stats

**Full Changelog**: [`v0.0.7..v1.0.0`](https://github.com/stackblitz-labs/bolt.diy/compare/v0.0.7...v1.0.0)
