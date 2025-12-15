# Tasks: Website Information Collection Agent

**Input**: Design documents from `/specs/001-info-collection-agent/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)
**Tests**: Not explicitly requested; no test tasks included.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = Complete flow, US2 = Partial flow, US3 = Corrections)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm environment prerequisites and secrets required for Supabase operations.

- [X] T001 Verify Supabase env secrets in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, types, and validators required before any user story work.

- [X] T002 Create migration for `info_collection_sessions` in `supabase/migrations/20251209000000_info_collection_sessions.sql`
- [X] T003 Add TypeScript types and Zod schemas in `app/types/info-collection.ts`
- [X] T004 Add URL validation utilities (website + Google Maps + placeId) in `app/utils/urlValidation.ts`

**Checkpoint**: Foundation ready—user story implementation can begin.

---

## Phase 3: User Story 1 - Complete Information Collection Flow (Priority: P1) 🎯 MVP

**Goal**: Collect website URL (optional), Google Maps URL (optional), and required description; finalize and queue crawler package.
**Independent Test**: User can complete all steps end-to-end, receive confirmation without crawler blocking.

### Implementation for User Story 1

- [X] T005 [US1] Implement Supabase service (CRUD + finalize) in `app/lib/services/infoCollectionService.ts`
- [X] T006 [P] [US1] Add system prompt for collection flow in `app/lib/prompts/infoCollectionPrompt.ts`
- [X] T007 [P] [US1] Implement AI SDK tools (start, collect URLs, description, finalize, delete, state) in `app/lib/tools/infoCollectionTools.ts`
- [X] T008 [US1] Wire tools into chat pipeline and system prompt gating in `app/routes/api.chat.ts`
- [X] T009 [US1] Add REST API route for sessions (list/active/create/delete) in `app/routes/api.info-collection.ts`
- [X] T010 [P] [US1] Add client store for session/progress state in `app/lib/stores/infoCollection.ts`
- [X] T011 [P] [US1] Add info collection status UI component in `app/components/chat/InfoCollectionStatus.tsx`

**Checkpoint**: User Story 1 fully functional and independently testable.

---

## Phase 4: User Story 2 - Partial Information Collection (Priority: P2)

**Goal**: Support users without website or Google Maps links; allow description-only completion.
**Independent Test**: User can skip URLs, provide only description, and finalize successfully.

### Implementation for User Story 2

- [X] T012 [US2] Ensure tools/service handle missing URLs (null storage, validated flags) in `app/lib/tools/infoCollectionTools.ts` and `app/lib/services/infoCollectionService.ts`
- [X] T013 [P] [US2] Update prompt/UX copy to clarify skip paths in `app/lib/prompts/infoCollectionPrompt.ts` and `app/components/chat/InfoCollectionStatus.tsx`

**Checkpoint**: User Story 2 fully functional and independently testable.

---

## Phase 5: User Story 3 - Information Correction and Update (Priority: P3)

**Goal**: Allow users to correct previously entered fields and delete sessions.
**Independent Test**: User can request changes to any collected field and see updated summary before finalizing; can delete session on request.

### Implementation for User Story 3

- [X] T014 [US3] Implement correction handling (updateCollectedInfo flows) in `app/lib/tools/infoCollectionTools.ts`
- [X] T015 [P] [US3] Support session delete endpoint path and tool calls in `app/routes/api.info-collection.ts`
- [X] T016 [P] [US3] Surface correction/delete affordances in UI copy/state in `app/components/chat/InfoCollectionStatus.tsx` and prompt context in `app/lib/prompts/infoCollectionPrompt.ts`

**Checkpoint**: User Story 3 fully functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Clean-up and release readiness.

- [X] T017 [P] Document the flow and endpoints in `docs/` (add README section for info collection)
- [X] T018 Run lint/typecheck/test suite after implementation (`pnpm run lint && pnpm run typecheck && pnpm run test`)
- [X] T019 [P] Verify migration applied in target environments and record in release notes

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Phase 1; blocks all user stories.
- User Stories (Phases 3–5): Depend on Phase 2. US1 → US2 → US3 (priority order). US2 and US3 can start after US1 core completes (shared tooling).
- Polish (Phase 6): After desired stories are complete.

### User Story Dependencies

- US1: None beyond foundational.
- US2: Depends on US1 base tools/service being present.
- US3: Depends on US1 base tools/service; can proceed in parallel with US2 once US1 landed.

### Within Each User Story

- Services before tools wiring, tools before API/chat wiring, API before UI.
- UI can proceed in parallel where marked [P] if underlying contracts are stable.

### Parallel Opportunities

- Foundational: T003, T004 can run in parallel after T002 stub exists.
- US1: T006, T007, T010, T011 can run in parallel; T008 and T009 depend on tools/service presence.
- US2: T013 can run in parallel with T012 once US1 base code exists.
- US3: T015 and T016 can run in parallel after T014 scaffolds correction handling.
- Polish: T017 and T019 can run in parallel; T018 after code complete.

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Phases 1–2 (Setup + Foundational).
2. Deliver Phase 3 (US1) end-to-end; validate flow without crawler blocking.
3. Optional deploy/demo after US1.

### Incremental Delivery
1. Finish Setup + Foundational.
2. Ship US1 (P1) → validate.
3. Add US2 (skip paths) → validate.
4. Add US3 (corrections/deletes) → validate.
5. Polish phase last.

