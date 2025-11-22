# Tasks: Phase 1 Implementation Plan

**Input**: Design documents from `/specs/001-phase1-plan/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure every contributor can run the Phase 1 stack locally with correct env configuration and template tooling.

- [X] T001 Update `.env.example` with `DATABASE_URL`, `R2_*`, `GOOGLE_PLACES_API_KEY`, and `OPENAI_API_KEY` placeholders plus inline instructions.
- [X] T002 [P] Add `pnpm templates:seed` and `pnpm templates:clone` scripts to `package.json` referencing `scripts/templates/*`.
- [X] T003 [P] Scaffold `scripts/templates/seed-registry.ts` and `scripts/templates/clone-starters.ts` with CLI args + TODO hooks for injecting starter templates.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, contracts, and services that every user story depends on. Complete before story work.  
**Dependencies**: `T005` → `T006` → template population; `T007` needs `.env` from `T001`; `T008` precedes all streaming routes; `T009` precedes edit + snapshot flows.

- [X] T004 Create Supabase migration `supabase/migrations/<timestamp>_phase1_core.sql` for `business_profiles`, `crawled_data`, `site_snapshots` tables per `data-model.md`.
- [X] T005 [P] Implement shared template + MasterContent Zod schemas in `app/lib/modules/templates/schema.ts` with strict typings and docs.
- [X] T006 [P] Build template registry loader with caching + schema validation in `app/lib/modules/templates/registry.server.ts`.
- [ ] T007 Implement Google Places crawler service with quota + caching guards in `app/lib/services/crawlerAgent.server.ts`.
- [ ] T008 [P] Extend SSE `SwitchableStream` helper + telemetry hooks in `app/lib/.server/llm/switchable-stream.ts`.
- [ ] T009 Implement WebContainer workspace orchestrator utilities in `app/lib/webcontainer/workspaceOrchestrator.ts` (create/start/stop, mount templates, snapshot/restore).
- [ ] T010 [P] Add R2/S3 object storage client + env validation in `app/lib/services/objectStorage.server.ts`.
- [ ] T011 Wire baseline telemetry utilities in `app/utils/logger.ts` for heartbeat counts, `performance.mark`, and SLA assertions shared by all routes.

**Checkpoint**: Database schema, schemas/contracts, crawler, SSE helper, workspace orchestrator, storage client, and telemetry scaffolding are ready.

---

## Phase 3: User Story 1 – Generate Ready-to-Edit Site (Priority: P1) 🎯 MVP

**Goal**: Operators submit a Google Maps URL and receive a populated premium template with crawled data, synthesized copy, and live preview.  
**Independent Test**: Call `POST /api.site.generate` with a seeded tenant and confirm SSE stages complete plus Preview pane renders without manual edits.

### Tests for User Story 1

- [ ] T012 [P] [US1] Add integration test for `/api.site.generate` SSE flow in `tests/integration/api.site.generate.test.ts` using mocked crawler/content outputs.
- [ ] T013 [P] [US1] Add template schema contract/unit tests in `tests/unit/templates/schema.test.ts`.
- [ ] T014 [P] [US1] Add orchestrator error-normalization unit tests covering crawler/content/website failures in `tests/unit/orchestrator/errorHandling.test.ts`.
- [ ] T015 [P] [US1] Add fallback content/testimonial unit tests in `tests/unit/content/fallbacks.test.ts` referencing FR-005.
- [ ] T016 [P] [US1] Add Playwright scenario validating PCC prompts for missing data in `tests/playwright/pcc-data-prompt.spec.ts`.
- [ ] T017 [P] [US1] Add Playwright scenario validating PCC error toasts/resume actions in `tests/playwright/pcc-error-states.spec.ts`.
- [ ] T018 [P] [US1] Add resume-flow integration test for `/api.site.generate` in `tests/integration/api.site.generate.resume.test.ts`.
- [ ] T019 [P] [US1] Add heartbeat stall tests in `tests/integration/api.site.generate.heartbeats.test.ts` asserting alerts fire when heartbeats halt >10 s.
- [ ] T020 [P] [US1] Add template guardrail test in `tests/integration/api.site.generate.template-guardrail.test.ts` ensuring the orchestrator reselects templates when required sections (menu, hero, testimonials) are missing.

### Implementation for User Story 1

- [ ] T021 [US1] Implement resumable SSE state store in `app/lib/services/orchestratorResume.server.ts` (persist `resumeToken`, SSE cursor, TTL, tenant scope).
- [ ] T022 [US1] Extend `app/routes/api.site.generate.ts` to emit resume metadata, accept resume requests, and stream stage milestones through `SwitchableStream`.
- [ ] T023 [US1] Update `app/components/workbench/PromptCommandCenter.tsx` to surface Resume CTA/state, reconcile logs, and announce status via ARIA live regions.
- [ ] T024 [US1] Record SSE heartbeat counts/timeouts in `app/utils/logger.ts` with structured events persisted to telemetry sinks.
- [ ] T025 [US1] Wire heartbeat dashboards/alerts via telemetry pipeline (Grafana or console summary) noting stalled thresholds.
- [ ] T026 [US1] Populate `templates/registry.json` and seed three starter templates under `templates/*` per the shared schema.
- [ ] T027 [US1] Implement Content Agent pipeline in `app/lib/services/contentAgent.server.ts` (template selection, Master Content JSON, fallback labeling).
- [ ] T028 [US1] Implement template validation + reselection guardrail in `app/lib/services/templateGuardrails.server.ts` (or Content Agent module) so missing sections trigger a re-run before handing off to Website Agent.
- [ ] T029 [US1] Implement Website Agent generation in `app/lib/services/websiteAgent.server.ts` (mount template, apply content/theme, trigger build).
- [ ] T030 [US1] Implement crawler → content → website orchestrator entry point in `app/routes/api.site.generate.ts` using new modules.
- [ ] T031 [US1] Build PCC progress + preview status UI in `app/components/workbench/PromptCommandCenter.tsx` with idle/loading/success/error/resume states.
- [ ] T032 [US1] Emit per-agent telemetry + `performance.mark('api.site.generate')` instrumentation proving p95 generation <3 min.
- [ ] T033 [US1] Normalize crawler/content/website error payloads into actionable PCC remediation hints in `app/routes/api.site.generate.ts`.
- [ ] T034 [US1] Surface actionable error + manual data prompts in PCC UI, ensuring focus trapping + keyboard accessibility.
- [ ] T035 [P] [US1] Perform accessibility + responsive QA (320/768/1280 px, reduced-motion fallbacks) on PCC states; fix findings in `app/components/workbench/PromptCommandCenter.tsx`.
- [ ] T036 [US1] Update `specs/001-phase1-plan/checklists/requirements.md` with premium template QA gates (contrast ≥4.5:1, breakpoint screenshots, Lighthouse ≥90).
- [ ] T037 [P] [US1] Add Templates 4–6 (`templates/restaurant-modern`, `templates/family-style`, `templates/cafe-bright`) plus registry + seeding updates.
- [ ] T038 [P] [US1] Add Templates 7–10 (`templates/fusion-night`, `templates/food-truck`, `templates/pastry-boutique`, `templates/ghost-kitchen`) plus registry + seeding updates.
- [ ] T039 [P] [US1] Create `tests/playwright/templates/premium-templates.spec.ts` to snapshot all templates, validate CTA links, and assert schema compliance.

**Checkpoint**: `/api.site.generate` streams stage milestones, PCC renders the preview with all states, and telemetry verifies SLA + fallback/guardrail behavior.

---

## Phase 4: User Story 2 – Iterate via Natural Language Edits (Priority: P2)

**Goal**: Operators issue natural-language prompts and see validated edits reflected within 20 s.  
**Independent Test**: Execute five edit prompts via PCC + `POST /api.site.modify`; verify targeted JSON paths update, preview refreshes under 20 s, and conflicting edits surface actionable errors.

### Tests for User Story 2

- [ ] T040 [P] [US2] Add intent-classifier unit tests covering confidence thresholds + guardrails in `tests/unit/orchestrator/intentClassifier.test.ts`.
- [ ] T041 [P] [US2] Add Playwright sequential edit loop scenario in `tests/playwright/pcc-edit-loop.spec.ts` asserting 20 s SLA.

### Implementation for User Story 2

- [ ] T042 [US2] Implement LLM-powered intent classifier + fallback guardrails in `app/lib/services/intentClassifier.server.ts` with typed command schemas.
- [ ] T043 [US2] Implement WebContainer mutation runner + optimistic locking in `app/lib/webcontainer/mutationRunner.ts`.
- [ ] T044 [US2] Implement `app/routes/api.site.modify.ts` to stream classification + mutation events, including rollback on validation failure.
- [ ] T045 [US2] Update PCC command input/results in `app/components/workbench/PromptCommandCenter.tsx` with idle/loading/success/error/retry states and ARIA live regions.
- [ ] T046 [US2] Add telemetry + rate limiting for edit commands in `app/lib/stores/workbenchStore.ts` and validate `performance.mark('edit-loop')` metrics via `app/utils/logger.ts`.

**Checkpoint**: Natural-language edits execute safely, respect confidence thresholds, refresh the preview within SLA, and expose actionable UI states.

---

## Phase 5: User Story 3 – Preserve and Share Site Versions (Priority: P3)

**Goal**: Operators save labeled snapshots to object storage and restore them without re-running agents.  
**Independent Test**: Run `/api.snapshot.save` followed by `/api.snapshot.restore`; confirm metadata persists in Postgres, archive exists in R2, and restored workspace renders previous content.

### Tests for User Story 3

- [ ] T047 [P] [US3] Add persistence unit tests for snapshot save/restore (`tests/unit/persistence/siteSnapshots.test.ts`).
- [ ] T048 [P] [US3] Add Playwright smoke covering “Save Version” + “Restore Version” controls in `tests/playwright/snapshot-flow.spec.ts`.

### Implementation for User Story 3

- [ ] T049 [US3] Implement snapshot archive service in `app/lib/services/snapshotService.server.ts` (package workspace, stream upload to R2, emit progress).
- [ ] T050 [US3] Implement `app/routes/api.snapshot.save.ts` with validation, telemetry, and progress events.
- [ ] T051 [US3] Implement `app/routes/api.snapshot.restore.ts` to rehydrate WebContainer workspaces with audit logging.
- [ ] T052 [US3] Add `app/lib/persistence/siteSnapshots.ts` helper for metadata queries + audit trails.
- [ ] T053 [US3] Update PCC UI with Save/Restore controls + idle/loading/success/error states in `app/components/workbench/PromptCommandCenter.tsx`.
- [ ] T054 [US3] Instrument snapshot save/restore performance (`performance.mark('snapshot-save')`, `'snapshot-restore'`) and log SLA verification in `app/utils/logger.ts`.

**Checkpoint**: Snapshots can be saved, listed, and restored with telemetry evidence and responsive UI states.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, compliance, telemetry, and release readiness.

- [ ] T055 [P] Run through `specs/001-phase1-plan/quickstart.md`, update any stale steps, and capture screenshots for docs.
- [ ] T056 Implement CI coverage delta publishing (coverage summary output + badge updates) via `package.json` scripts/CI workflow.
- [ ] T057 Enforce removal of temporary logging/feature flags referenced in `spec.md` by auditing `app/routes/api.*` and `app/lib/services/*` before release.
- [ ] T058 Final `pnpm run lint && pnpm run typecheck && pnpm run test && pnpm exec playwright test` recorded in CI logs; update `README.md` badges if needed.

---

## Dependencies & Execution Order

- Phase 1 Setup → enables env configuration + template tooling.  
- Phase 2 Foundational → blocks all user stories; finish before Phase 3+.  
- User Story phases → execute in priority order (US1 → US2 → US3); US2/US3 may run in parallel once foundational tasks complete.  
- Phase 6 Polish → runs after desired user stories ship; ensures compliance + performance validation.

### User Story Dependency Graph

1. **US1 (Generation)** — depends on Foundational only.  
2. **US2 (Edit Loop)** — depends on US1 data contracts + Foundational streaming utilities.  
3. **US3 (Snapshots)** — depends on US1 workspace outputs; independent of US2.

---

## Parallel Execution Examples

- After Phase 2, run `T037`/`T038` (template expansion) in parallel with `T027`/`T028` (content agent + guardrails) since they touch different directories.  
- While `T042` (intent classifier) runs, another dev can tackle `T043` (mutation runner) because they only share documented contracts.  
- Snapshot UI task `T053` can proceed in parallel with backend tasks `T049`–`T052` once API stubs exist.

---

## Implementation Strategy

1. **MVP First**: Complete Phases 1–3 to deliver the initial generation-only flow and validate telemetry budgets.  
2. **Incremental Delivery**: Layer US2 (interactive edits) next, ensuring 20 s SLA instrumentation before tenant-wide rollout.  
3. **Value-Add**: Ship US3 snapshots for audit/comparison workflows, then execute polish tasks.  
4. **Quality Gates**: Every phase requires passing lint/typecheck/test + relevant Playwright suites; block releases lacking telemetry or coverage evidence.

---

## Task Count

- Total tasks: 58  
- US1 tasks: 28  
- US2 tasks: 7  
- US3 tasks: 8  
- Parallel-marked tasks: 17  
- Independent tests defined for US1–US3 as required by the updated spec.
