---
description: Review, proofread, and refine existing Beads issues (quality + dependency graph) for this Remix/TypeScript/Cloudflare Pages repo
argument-hint: "[optional scope: open|all|epic:<id>|<id> <id> ...]"
---

# Review Beads Issues (Remix + TypeScript + Cloudflare Pages)

You are reviewing **existing** Beads issues/epics/stories/tasks to make them easy to implement in this repository.

Repo context (use in your edits):
- **Stack:** Remix 2.15 + Vite, **TypeScript (strict)**, **Cloudflare Pages**
- **Source:** `app/` with `~/...` import alias → `app/...`
- **Key areas:** `app/routes/`, `app/lib/`, `app/components/`
- **State:** nanostores, zustand, IndexedDB (reuse existing patterns)
- **AI:** Vercel AI SDK; providers in `app/lib/modules/llm/providers/`
- **Runtime:** WebContainer API in `app/lib/runtime/`
- **Tests:** Vitest + Playwright
- **Build gates:** `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`

**Goal:** Mechanical quality improvements + dependency hygiene **without changing intent**. If intent is unclear, add "Clarify" questions.

---

## Hard Rules

1. **Snapshot first** before any edits.
2. **Safe edits only:** improve wording/structure; do not change meaning.
3. **Don't guess:** if ambiguous, add explicit questions and mark as needing clarification.
4. **Max 5 passes** (stop early if clean).
5. **Validate dependencies** after changes (cycles + "ready" set sanity).

---

## Phase 0 — Parse Scope (MANDATORY)

Interpret `$ARGUMENTS`:

- empty → `open`
- `open` → review open issues
- `all` → review all issues
- `epic:<id>` → that epic + its descendants
- `<id> <id> ...` → specific issue IDs

Print:

```text
🧭 REVIEW SCOPE
────────────────────────
Target: <open|all|epic:...|ids...>
Mode:   review + safe fixes
Passes: up to 5
────────────────────────
```

---

## Phase 1 — Snapshot & Preconditions (MANDATORY)

### 1.1 Verify Beads CLI
```bash
bd --version
```

If unavailable: **STOP** and ask the user to install/configure Beads.

### 1.2 Snapshot current state (backup)
```bash
bd list --json > /tmp/beads-snapshot-$(date +%Y%m%d-%H%M%S).json
```

If snapshot fails: **STOP**.

---

## Phase 2 — Load Issues & Build Manifest (MANDATORY)

### 2.1 Load list(s)
```bash
bd list --json
bd ready --json
```

Filter according to scope.

### 2.2 Hydrate details for each issue in scope
```bash
bd show <id> --json
```

Capture: `id, title, status, priority, type, description, acceptance_criteria, notes, dependencies`

### 2.3 Print Review Manifest
```text
📦 REVIEW MANIFEST
────────────────────────
□ bd-...  <type>  P<prio>  <title>
□ bd-...  <type>  P<prio>  <title>
...
────────────────────────
Total: <N>
```

If zero issues match scope:
```text
⚠️ No issues found for scope: $ARGUMENTS
Try: /review-beads open  or  /review-beads all
```

---

## Phase 3 — Review Pass Loop (up to 5)

Repeat passes until clean or 5 passes reached.

```text
🔁 REVIEW PASS X/5
════════════════════════════════════════
```

---

### 3.A Audit Checklist (per issue)

#### A1) Clarity
- Title is specific and action-oriented (avoid "Fix bug", "Update code")
- Description states **what** + **why**
- Terms are defined (especially AI/runtime/state specifics)

#### A2) Fit to this repo
- Mentions correct areas when relevant:
  - Routes: `app/routes/` (loader/action/UI orchestration)
  - Logic: `app/lib/` (business logic, integrations)
  - Components: `app/components/` (UI)
- Notes any **server-only** needs (`.server.ts/.server.tsx`)
- Avoids Node-only assumptions (Cloudflare Pages/edge constraints)

#### A3) Acceptance Criteria
- Has checkboxes
- Includes verification signal (unit test / e2e / manual steps)
- Calls out required gates: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run build`

#### A4) Scope & sizing
- Task is implementable without hidden requirements
- Big items are split (epic/story with children)

#### A5) Dependencies
- Dependencies match actual blocking order
- No "depends on child" anti-pattern
- >8 deps usually over-constrained

---

### 3.B Apply Safe Fixes (mechanical only)

#### B1) Title normalization
- Epic: `Epic: <feature>`
- Story: `US#: <user-visible outcome>`
- Task: `T###: <verb> <component> (so that <result>)`
- Bug: `Bug: <symptom> in <location> (<trigger>)`

```bash
bd update <id> --title "T014: Prevent null crash in <module> when <condition>" --json
```

#### B2) Add/append description scaffolding (don't overwrite)

If sparse, append:

```text
## Summary
<TODO: 1–2 sentences>

## Context
<TODO: why it matters>

## Proposed Approach
- <TODO: brief steps>

## Relevant Code Areas
- app/routes/<...>
- app/lib/<...>
- app/components/<...>
- app/lib/modules/llm/providers/<...> (if AI/provider)
- app/lib/runtime/<...> (if WebContainer/runtime)

## Edge/Runtime Notes (Cloudflare Pages)
- <TODO: Node-only restrictions / env bindings>

## Testing / Verification
- <TODO: vitest path or playwright scenario>
- Gates: pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build

## Acceptance Criteria
- [ ] <TODO>
```

#### B3) Acceptance criteria patch (minimal defaults)

If missing:
- [ ] Behavior matches description
- [ ] Typecheck passes (`pnpm run typecheck`)
- [ ] Lint passes (`pnpm run lint`)
- [ ] Tests updated/added (`pnpm run test`)
- [ ] Build passes (`pnpm run build`)

#### B4) Clarification handling (don't guess)

If intent is unclear, add a **Clarify** section:

```text
## Clarify (needs human input)
- [ ] What is the expected user-visible outcome?
- [ ] Which route/module is the integration point?
- [ ] Any Cloudflare Pages constraints (KV/R2/Supabase/env bindings)?
- [ ] What tests prove completion?
```

---

### 3.C Dependency Hygiene

#### C1) Remove redundant edges
```bash
bd dep remove <blocked-id> <blocker-id> --json
```

#### C2) Add missing blockers (only if ordering is truly required)
```bash
bd dep add <blocked-id> <blocker-id> --json
```

#### C3) Validate for cycles

Try native detection first:
```bash
bd dep cycles --json
```

If not available, build a local dependency graph from `bd show` outputs and detect cycles manually. If a cycle is found, propose the **smallest** edge removal and **ask for confirmation**.

#### C4) Sanity check "ready" set
```bash
bd ready --json
```
Should have at least some ready tasks unless intentionally fully blocked.

---

### 3.D Pass Summary

```text
🧾 PASS X SUMMARY
────────────────────────
Titles updated:         <n>
Descriptions scaffolded:<n>
AC improved:            <n>
Deps added/removed:     +<n> / -<n>
Clarify flags added:    <n>
Remaining issues:       <n>
────────────────────────
```

Stop early if remaining issues = 0.

---

## Phase 4 — Final Report (MANDATORY)

```text
✅ BEADS REVIEW COMPLETE
════════════════════════════════════════

Scope:           $ARGUMENTS
Passes used:     X/5
Issues reviewed: <N>

Quality outcomes
────────────────────────
- Clear titles:            <n>/<N>
- Has Summary/Context:     <n>/<N>
- Has Acceptance Criteria: <n>/<N>
- Cloudflare/Remix fit:    <n>/<N>

Dependency health
────────────────────────
Cycles:      <0|found>
Ready tasks: <count>

Needs human clarification
────────────────────────
- bd-... <title> — <one-line why>
- bd-... <title> — <one-line why>

Next
────────────────────────
Run: bd ready --json
Then: /implement-beads <id>
════════════════════════════════════════
```

---

## Notes on Spec‑Kit Compatibility

- If an issue is a **story/epic** lacking a plan, recommend:
  - `/speckit.tasks` to generate/refresh tasks
  - Ensure Beads issue AC aligns with tasks
- If `.specify/` contains a relevant spec/plan, add a short reference in the Beads issue notes.

---

## Quick Reference

```bash
# Snapshot
bd list --json > /tmp/beads-snapshot-$(date +%Y%m%d-%H%M%S).json

# Load
bd list --json
bd ready --json
bd show <id> --json

# Update
bd update <id> --title "..." --json
bd update <id> --description "..." --json
bd update <id> --priority 2 --json
bd update <id> --append-notes "..." --json

# Dependencies
bd dep add <blocked> <blocker> --json
bd dep remove <blocked> <blocker> --json

# Cycles (if supported)
bd dep cycles --json

# After review
bd ready --json
/implement-beads <id>
```
