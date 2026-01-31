---
description: Implement a Beads issue in this Remix/TypeScript/Cloudflare Pages repo using the existing spec-kit workflow where useful.
argument-hint: <beads-issue-id> [--scope backend|frontend|full] [--dry-run]
---

# Implement Beads Issue (Remix + TypeScript + Cloudflare Pages)

You are implementing a Beads issue (task/story/epic) in this repository.

This repo is **Remix 2.15 + Vite + strict TypeScript** deployed to **Cloudflare Pages**.
- Remix source: `app/`
- Preferred imports: `~/...` (alias to `app/...`)
- Routes: `app/routes/`
- Shared libs: `app/lib/`
- UI components: `app/components/`
- Server-only modules: use `.server.ts` / `.server.tsx` and **never import them from client code**
- State: nanostores, zustand, IndexedDB (use existing patterns; don't introduce new state libraries)
- Tests: Vitest + Playwright (run via `pnpm run test` unless a more specific command exists)

**CRITICAL:** Read issue → check dependencies → plan → implement incrementally → run verification gates → close.

---

## Hard Rules (Do Not Violate)

1. **No blind coding**: load the Beads issue and relevant existing patterns first.
2. **Respect Remix boundaries**: server-only code stays server-only; avoid Node-only APIs in edge runtime.
3. **Keep changes minimal**: reuse existing modules, patterns, and providers; avoid new libraries unless necessary.
4. **Tests + type safety**: strict TS, no `any`, no `@ts-expect-error`. Prefer Zod where contracts exist.
5. **Verification gates are mandatory** before closing:
   - `pnpm run typecheck`
   - `pnpm run lint`
   - `pnpm run test`
   - `pnpm run build`

---

## Phase 0 — Preconditions & Intake (MANDATORY)

### 0.1 Parse Arguments

From `$ARGUMENTS` parse:
- **Required**: `$ISSUE_ID` (e.g., `bd-abc123`)
- **Optional**:
  - `--scope backend|frontend|full`
  - `--dry-run` (plan only: **no file changes**, **no `bd update`**, **no `bd close`**)

If `$ISSUE_ID` is missing, stop and show usage:
```text
/implement-beads <beads-issue-id> [--scope backend|frontend|full] [--dry-run]
```

---

### 0.2 Verify Beads CLI Availability

```bash
bd --version
```

If `bd` is not available: **STOP** and instruct the user to install/configure Beads.

---

### 0.3 Load Issue Context

```bash
bd show "$ISSUE_ID" --json
```

Extract and display:

```text
🧩 BEADS ISSUE LOADED
════════════════════════════════
ID:         <id>
Type:       epic | story | task
Title:      <title>
Status:     open | in_progress | blocked | deferred | closed
Priority:   <priority>

Description:
<description>

Acceptance Criteria:
- [ ] <criterion 1>
- [ ] <criterion 2>

Dependencies:
- <list dependency IDs or "none">
════════════════════════════════
```

Also extract any mentioned paths (strings that look like `app/...`, `~/...`, `package.json`, etc.) and list them under "Mentioned Files".

If issue is already `closed`, stop and ask whether to reopen/continue (do not proceed automatically).

---

### 0.4 Dependency Gate (Blocked Work Must Not Start)

Use `bd ready` to confirm it's implementable.

```bash
bd ready --json
```

If the issue is **not present** in `bd ready`, treat it as blocked and show:

```text
⛔ ISSUE NOT READY (BLOCKED OR NOT ELIGIBLE)
────────────────────────────────────────
Action:
- Implement the blocking issues first, OR
- Remove/adjust invalid dependencies in Beads
────────────────────────────────────────
```

**STOP** here if blocked/not ready.

---

### 0.5 Determine Scope (or Use `--scope`)

Interpret scope in this repo as:

- **backend**: Remix server work (loaders/actions), server-only modules, Cloudflare runtime integration, auth/session, data access, API/proxy, ".server.ts".
- **frontend**: React components, routes UI, hooks, state (nanostores/zustand), styling, client behavior.
- **full**: both.

If `--scope` is provided, use it. Otherwise infer:

| Issue Mentions | Scope |
|---|---|
| `loader`, `action`, `headers`, `cookies`, `session`, `auth`, `Cloudflare`, `Pages`, `env`, `KV`, `R2`, `Supabase`, `.server`, "edge/runtime", "API", "provider" | backend |
| `component`, `UI`, `route`, `form`, `modal`, `table`, `nanostore`, `zustand`, `IndexedDB`, `shadcn`, `Radix`, `UnoCSS`, `styles` | frontend |
| "end-to-end", "both", "full-stack", or clearly spans server + UI | full |

Print:

```text
🎯 SCOPE
────────────────────────
Scope: <backend|frontend|full>
Reason: <one sentence>
Dry-run: <true|false>
────────────────────────
```

---

### 0.6 Mark In Progress (unless `--dry-run`)

If status is `open`, update to `in_progress`:

```bash
bd update "$ISSUE_ID" --status in_progress --json
```

If `--dry-run`, do not update anything and clearly state that no status changes will be made.

---

## Phase 1 — Load Minimal Codebase Context (MANDATORY)

**Goal:** Identify the house style and reuse existing patterns. Do not scan the whole repo.

### 1.1 Always Load Anchor Files

Read (or locate) these to align with repo conventions:

- `AGENTS.md` (commands, architecture, constraints)
- `package.json` (scripts: confirm `build`, `typecheck`, `lint`, `test`)
- One representative route module under `app/routes/` (pick the closest to the feature area)
- A representative component under `app/components/`
- A representative lib module under `app/lib/`

If the issue is AI/provider-related, also inspect:
- `app/lib/modules/llm/providers/` (pick the nearest provider file)
- any shared LLM types or registry modules nearby

If the issue is runtime/WebContainer-related:
- `app/lib/runtime/action-runner.ts` and any adjacent runtime modules

---

### 1.2 Load Speckit Artifacts (SOURCE OF TRUTH)

Beads issues created by `/speckit.beads` include a `Source` reference to a spec folder in their description. **These artifacts are the source of truth for implementation.**

**Extract Spec Folder from Issue Description:**

In the issue description (from `bd show`), look for lines like:
```text
## Source
Spec: specs/001-project-chat-sync
```

Or in task issues:
```text
## Source
Derived from: spec.md, data-model.md
```

**Set `$SPEC_DIR`**: Extract the path after `Spec:` (e.g., `specs/001-project-chat-sync`)

If no spec folder is found in the description, skip to 1.3 and proceed without spec artifacts.

**Load Spec Artifacts (if $SPEC_DIR exists):**

```bash
cat "$SPEC_DIR/plan.md"           # Tech stack, structure, phases
cat "$SPEC_DIR/spec.md"           # User stories, acceptance criteria
cat "$SPEC_DIR/data-model.md" 2>/dev/null    # Entity definitions
cat "$SPEC_DIR/research.md" 2>/dev/null      # Technical decisions
ls "$SPEC_DIR/contracts/" 2>/dev/null && cat "$SPEC_DIR/contracts/"* 2>/dev/null
```

**Use these as implementation guidance:**

| Artifact | Use For |
|----------|---------|
| `plan.md` | Tech stack, project structure, phase context |
| `spec.md` | User story details, acceptance scenarios, edge cases |
| `data-model.md` | Entity attributes, relationships, validation rules |
| `contracts/` | API schemas, request/response formats, endpoints |
| `research.md` | Technical decisions, library choices, constraints |

If no spec folder is referenced, proceed using only the issue description and codebase patterns.

---

### 1.3 Load Issue-Specific Codebase Context

Based on "Mentioned Files" or inferred scope, load only what's needed:

- Routes: `app/routes/<relevant>.tsx`
- UI: `app/components/<relevant>.tsx`
- Lib modules: `app/lib/<relevant>.ts`
- Server-only: `app/**/<name>.server.ts`
- State: stores under `app/lib/**` (nanostores/zustand/IDB usage)

---

### 1.4 Summarize Discovered Patterns (Short)

Produce a short "patterns discovered" note:

```text
📐 PATTERNS DISCOVERED
════════════════════════════════
- Imports: use ~/... alias
- Route pattern: <loader/action usage, data handling, error boundaries>
- Server-only boundary: <how .server.ts is used>
- State pattern: <nanostore/zustand/IDB conventions>
- Validation/contracts: <zod usage or existing types>
- Testing pattern: <vitest location + style>
════════════════════════════════
```

---

## Phase 2 — Implementation Plan (MANDATORY, Keep It Short)

### 2.1 Map Acceptance Criteria → Concrete Changes

For each acceptance criterion, cross-reference with spec artifacts (loaded in Phase 1.2) to determine:
- What files change? (use paths from `plan.md` project structure)
- What new code is needed? (use schemas from `data-model.md`, `contracts/`)
- What test(s) prove it? (use scenarios from `spec.md`)

Output a compact plan:

```text
🧠 IMPLEMENTATION PLAN
════════════════════════════════
AC1: <text>
- Changes:
  - app/routes/<x>.tsx: <what>
  - app/lib/<y>.ts: <what>
- Tests:
  - <vitest test path>: <what it asserts>

AC2: <text>
- Changes: ...
- Tests: ...
════════════════════════════════
```

---

### 2.2 Clean Architecture / SOLID (Adapted to Remix)

Use this repo's natural layering (keep it pragmatic, not ceremonial):

- **Routes (`app/routes/`)**: orchestration (loader/action), HTTP concerns, call into `app/lib/**`
- **Lib (`app/lib/`)**: business logic, integrations, provider abstractions, pure utilities
- **Components (`app/components/`)**: UI rendering, user interactions, minimal logic
- **State**: nanostores/zustand modules (keep IO boundaries clear; do not mix server-only dependencies)

Rules:
- Keep loaders/actions thin; push complex logic into `app/lib/...`.
- Avoid cross-importing UI → server-only modules.
- Prefer dependency injection by passing explicit parameters (e.g., `env`, config) instead of hidden globals.

---

## Phase 3 — Implement Incrementally (TDD‑Oriented)

### 3.1 Test-First (When Practical)

- Add/adjust unit tests for `app/lib/**` logic using Vitest.
- For route-level behavior, prefer testing the underlying lib function(s).
- Add Playwright only if the acceptance criteria is explicitly E2E/UI workflow oriented.

### 3.2 Implementation Guidelines (Remix + Cloudflare)

- **Cloudflare Pages runtime:** avoid Node-only APIs unless the project already uses a polyfill.
- Keep request/response headers/cookies correct; don't leak secrets to the client.
- If adding env usage, follow existing patterns for Cloudflare env bindings.
- If touching AI providers, follow the existing provider interface(s) in `app/lib/modules/llm/providers/`.

### 3.3 Document What You Changed (As You Go)

Maintain a running list:
- Files changed
- New exports/APIs
- How to test locally

---

## Phase 4 — Verification Gates (MANDATORY)

Run from repo root:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Produce a gate report:

```text
✅ VERIFICATION GATES
════════════════════════════════
typecheck:  PASS
lint:       PASS
test:       PASS
build:      PASS
════════════════════════════════
```

If any gate fails:
- Do not close the Beads issue
- Keep status `in_progress`
- Summarize failures + next actions

---

## Phase 5 — Update Beads + Close (Skip if `--dry-run`)

### 5.1 Append Implementation Notes to the Issue

```bash
bd update "$ISSUE_ID" --append-notes "
## Implementation Notes ($(date +%Y-%m-%d))

### What changed
- app/routes/<...>.tsx: <summary>
- app/lib/<...>.ts: <summary>

### How to verify
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build

### Notes / Limitations
- <if any>
" --json
```

---

### 5.2 Close the Issue

```bash
bd close "$ISSUE_ID" --reason "Implemented per acceptance criteria. Verified: typecheck, lint, test, build all pass." --json
```

---

## Output Summary (Always)

At the end, print:

```text
✅ BEADS ISSUE COMPLETED
════════════════════════════════
Issue:  <id> — <title>
Scope:  <backend|frontend|full>

Files changed:
- <path>
- <path>

Verification:
- pnpm run typecheck: PASS
- pnpm run lint:      PASS
- pnpm run test:      PASS
- pnpm run build:     PASS

Beads:
- status: closed
════════════════════════════════
Next: bd ready --json
```

If `--dry-run`, print instead:

```text
🧪 DRY RUN COMPLETE
════════════════════════════════
No files were changed.
No Beads status was updated.
Proposed plan + verification steps are ready.
════════════════════════════════
```

---

## Error Handling

### Issue Not Found
```bash
bd list --json
```
Ask the user to confirm the correct ID.

### Issue Blocked
Show blockers and stop. Recommend implementing blockers first.

### Verification Failures
- Keep issue `in_progress`
- Provide the exact failing output summary and a short fix plan
- Re-run gates after fixes

---

## Quick Reference

```bash
# Implement
/implement-beads bd-abc123

# Plan only (no changes, no bd updates)
/implement-beads bd-abc123 --dry-run

# Force explicit scope
/implement-beads bd-abc123 --scope backend
/implement-beads bd-abc123 --scope frontend
/implement-beads bd-abc123 --scope full

# Beads CLI
bd show <id> --json
bd list --json
bd ready --json
bd update <id> --status in_progress
bd close <id> --reason "..."

# Verification (this repo)
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

---

## Architecture Quick Reference

```
app/                         # Remix source
├── routes/                  # Remix routes (loaders/actions + UI)
│   ├── api.*.ts            # API routes (server-only)
│   └── *.tsx               # Page routes
├── components/             # React/UI components
├── lib/                    # Business logic, integrations
│   ├── modules/llm/        # LLM providers + registry
│   ├── runtime/            # WebContainer action runner
│   └── stores/             # nanostores/zustand state
├── styles/                 # UnoCSS, design tokens
├── types/                  # TypeScript definitions
└── utils/                  # Shared utilities

Testing
────────────────────────────
test/                       # Vitest unit/integration tests
tests/                      # Playwright E2E tests
```
