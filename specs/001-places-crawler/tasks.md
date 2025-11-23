# Tasks: Google Places Crawler Service

**Input**: Design documents from `/specs/001-places-crawler/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

## Format: `[ID] [P?] [Story] Description`
- `[P]` → safe to run in parallel (different files, no blocking dependency)
- `[Story]` → user-story label (US1, US2, US3). Setup/Foundational/Polish omit labels.

---

## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Ensure local environments can reach the internal Places Data Service and run Supabase/templates tooling.

- [X] T001 Add `INTERNAL_PLACES_SERVICE_URL` and `INTERNAL_PLACES_SERVICE_TOKEN` placeholders with inline warnings to `.env.example`.
- [X] T002 Document internal service bootstrapping + mock instructions (sample curl, expected responses) in `docs/requirements/Phase1.md`.
- [X] T003 [P] Re-run `pnpm templates:clone` + `pnpm templates:seed`, capturing any deltas in `docs/requirements/Phase1.md` (single source for template tooling notes).

---

## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Shared schema, clients, and telemetry required by all user stories.

- [X] T004 Create Supabase migration under `supabase/migrations/` adding `sources_used`, `raw_payload_ref`, stricter `status`, and `cache_expires_at` constraints for `crawled_data`.
- [X] T005 Extend `app/lib/config/env.server.ts` to validate internal service vars + PCC accessibility feature flag (FR-011), exposing typed config.
- [X] T006 [P] Scaffold `app/lib/services/internalPlacesClient.server.ts` wrapping `/crawler/fetch`, `/crawler/cache/invalidate`, `/crawler/quota` endpoints from `contracts/crawler-service.openapi.yaml`.
- [X] T007 [P] Add crawler telemetry helpers (performance marks, `sourceMix`, `quotaState`, `toastMetrics`) in `app/utils/logger.ts`.

**Checkpoint**: Schema/env/client/telemetry ready → proceed to user stories.

---

## Phase 3: User Story 1 – Capture Verified Place Profile (Priority: P1) 🎯
**Goal**: Collect inputs via PCC chat, call crawler, persist multi-source data, and display provenance + remediation guidance with accessibility hooks (FR-011).
**Independent Test**: Operator issues “Generate a website…”, PCC requests missing data inline, crawler runs, `crawled_data` gains normalized entry, PCC shows provenance badges, “Needs data” chips, and accessible high-visibility toast with CTA when errors occur.

### Tests for User Story 1
- [ ] T008 [P] [US1] Expand `tests/unit/services/crawlerAgent.test.ts` for URL normalization, schema validation, tenant guard, raw payload refs, and PCC toast DTOs.
- [ ] T009 [P] [US1] Extend `tests/integration/api.site.generate.test.ts` to simulate the conversational collection flow + crawler execution, ensuring SSE + PCC logs stay in sync.

### Implementation for User Story 1
- [ ] T010 [US1] Define `CrawlRequest`/`CrawlResult` Zod schemas (sections, `missingSections`, `quotaState`, `error.ctaId`, `rawPayloadRef`) in `app/lib/services/crawlerAgent.schema.ts`.
- [ ] T011 [US1] Implement request normalization + input verification logic (Maps URL parsing, tenant scope) in `app/lib/services/crawlerAgent.server.ts`.
- [ ] T012 [US1] Persist raw payload + normalized summary with TTL/provenance auditing to `crawled_data` via Supabase inside `app/lib/services/crawlerAgent.server.ts`.
- [ ] T013 [US1] Update `app/routes/api.site.generate.ts` to orchestrate PCC chat prompts (collect URLs/handles, confirm when complete, emit "Running crawler…" message) and pass crawler payloads downstream.
- [ ] T014 [US1] Implement PCC provenance badges, tooltips, and “Needs data” chips in `app/components/workbench/PromptCommandCenter.tsx`, including keyboard focus + ARIA labels per FR-011.
- [ ] T015 [US1] Map crawler error codes to deterministic toast/log copy + CTA metadata, showing destructive toasts pinned at top (≥6 s, role="alert", Escape dismiss) in `PromptCommandCenter.tsx` and storing copy in shared config.

**Checkpoint**: Conversational flow, crawler execution, provenance/missing data UI, and accessible toasts working end-to-end.

---

## Phase 4: User Story 2 – Guard Against Quota Exhaustion (Priority: P1)
**Goal**: Enforce per-minute/daily quotas, emit telemetry, and drive PCC alerts + CTAs when budgets near exhaustion.
**Independent Test**: Simulate quota usage to 80%; ensure crawler throttles at 100%, SSE emits warnings, PCC shows alert toast + CTA with telemetry logs.

### Tests for User Story 2
- [ ] T016 [P] [US2] Add quota warning/exhaustion cases to `tests/unit/services/crawlerAgent.test.ts` (ledger math, cooldown windows, PCC alert DTOs).
- [ ] T017 [P] [US2] Create `tests/integration/api.site.generate.heartbeats.test.ts` verifying SSE + PCC outputs for warning vs blocking states.

### Implementation for User Story 2
- [ ] T018 [US2] Implement `QuotaLedger` tracking (80% warn, 100% block, reset time) inside `app/lib/services/crawlerAgent.server.ts` using `/crawler/quota` data.
- [ ] T019 [US2] Emit quota telemetry (`tenantId`, `percentage`, `state`, `timeToReset`) + heartbeat counters via `app/utils/logger.ts`.
- [ ] T020 [US2] Translate quota errors into SSE events and PCC chat summaries in `app/routes/api.site.generate.ts`, including “retry after” guidance.
- [ ] T021 [US2] Render PCC alert tiers (warning toast vs blocking toast + CTA) with accessibility hooks in `app/components/workbench/PromptCommandCenter.tsx`.

**Checkpoint**: Quota enforcement + observability cover multi-tenant safety.

---

## Phase 5: User Story 3 – Reuse Cached Crawls for Resumes (Priority: P2)
**Goal**: Serve cache hits for resume flows, allow manual invalidation/force-refresh, and show state inside PCC conversations.
**Independent Test**: Run generation twice within TTL → second run uses cache; force-refresh invalidates entry, re-runs crawler, PCC logs reflect actions.

### Tests for User Story 3
- [ ] T022 [P] [US3] Expand `tests/integration/api.site.generate.resume.test.ts` for cache hits, force-refresh, cross-tenant rejections, and PCC resume messaging.
- [ ] T023 [P] [US3] Add unit tests for cache-only paths, `NO_SOURCE_DATA`, and manual invalidation logic in `tests/unit/services/crawlerAgent.test.ts`.

### Implementation for User Story 3
- [ ] T024 [US3] Implement cache lookup short-circuit + provenance auditing (including `rawPayloadRef`) in `app/lib/services/crawlerAgent.server.ts`.
- [ ] T025 [US3] Wire manual invalidation/force-refresh flow via `/crawler/cache/invalidate` and Supabase updates (logging operator + reason) in `app/lib/services/crawlerAgent.server.ts`.
- [ ] T026 [US3] Update `app/routes/api.site.generate.ts` resume handler to fetch cached payloads via `resumeToken`, requeue force-refresh when flagged, and emit chat confirmations.
- [ ] T027 [US3] Enhance PCC resume UI in `app/components/workbench/PromptCommandCenter.tsx` to show cache hit badges, refresh countdown, invalidation prompts, and accessible messaging per FR-011.

**Checkpoint**: Resume flows stay within SLA with transparent cache reuse + operator controls.

---

## Phase 6: Telemetry, Accessibility, & Polish
**Purpose**: Prove success criteria, finalize PCC accessibility (FR-011), and document operator flows.

- [ ] T028 [P] Instrument crawler latency metrics (`performance.mark('crawler.request:start|end')`) in `app/lib/services/crawlerAgent.server.ts`, documenting SC-001 validation steps.
- [ ] T029 [P] Implement cache hit-rate reporting (rolling 24 h per tenant) via Supabase SQL or logger aggregation, and record verification steps for SC-002 in `specs/001-places-crawler/quickstart.md`.
- [ ] T030 [P] Validate quota alerts emit within 60 s (SC-003) via telemetry dashboard or console summary, capturing instructions in `docs/runbooks/crawler.md`.
- [ ] T031 [P] Audit PCC accessibility end-to-end (keyboard focus loops, ARIA labels for badges/chips/toasts, `role="alert"` announcements) and document results + fixes in `specs/001-places-crawler/quickstart.md`.
- [ ] T032 Run repo quality gates: `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm exec vitest run tests/unit/services/crawlerAgent.test.ts`.
- [ ] T033 Update `docs/runbooks/crawler.md` with operator playbook (conversational prompts, quota handling, cache invalidation, telemetry dashboards, PCC accessibility expectations).

---

## Dependencies & Execution Order
- Phase 1 → Phase 2 unlocks user stories.
- US1 (conversation + crawler contract) must complete before US2/US3.
- US2 depends on telemetry/env helpers (T005–T007) and US1 schema.
- US3 depends on US1 schema + Supabase migration (T004) and shares PCC UI components.
- Telemetry/accessibility polish (T028–T033) depends on instrumentation and PCC UI produced in US1–US3.

## Parallel Execution Examples
- T006/T007 can proceed while T004/T005 finish.
- After T010 lands, PCC UI tasks (T014–T015) can run alongside backend persistence (T012).
- US2 tasks split across backend (T018–T020) and PCC UI (T021).
- US3 cache logic (T024–T026) can move forward alongside PCC resume UI (T027) once contracts stabilized.
- Telemetry/accessibility tasks (T028–T031) can run concurrently once instrumentation is available.

## Implementation Strategy
1. **MVP (US1)**: Deliver T001–T015 for conversational input collection, crawler execution, provenance guidance, and PCC accessibility/toast behaviors per FR-011.
2. **Guardrails (US2)**: Add quota enforcement + alerts (T016–T021).
3. **Resume Efficiency (US3)**: Ship cache reuse + manual invalidation flows (T022–T027).
4. **Telemetry & Accessibility polish**: Complete T028–T033, then proceed to build implementation.
