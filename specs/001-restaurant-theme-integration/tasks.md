# Tasks: Restaurant Theme Integration

**Input**: Design documents from `/specs/001-restaurant-theme-integration/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Unit tests included for registry utilities (per plan.md). E2E tests are manual verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is an existing Remix monolith. All paths are relative to repository root:
- Types: `app/types/`
- Theme prompts: `app/theme-prompts/`
- Utils: `app/utils/`
- Components: `app/components/`
- Routes: `app/routes/`
- Server lib: `app/lib/.server/`
- Tests: `tests/unit/`

---

## Phase 1: Setup (Type Definitions)

**Purpose**: Create TypeScript type foundations for restaurant themes

- [ ] T001 [P] Create `RestaurantThemeId` type union in `app/types/restaurant-theme.ts`
- [ ] T002 [P] Create `RestaurantTheme` interface in `app/types/restaurant-theme.ts`
- [ ] T003 Extend `Template` interface with `category` and `restaurantThemeId` fields in `app/types/template.ts`

**Checkpoint**: Type definitions complete. Run `pnpm run typecheck` to verify no type errors.

---

## Phase 2: Foundational (Theme Registry & Constants)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Import all 12 theme prompt `.md` files using `?raw` suffix in `app/theme-prompts/registry.ts`
- [ ] T005 Create `RESTAURANT_THEMES` array with all 12 theme definitions in `app/theme-prompts/registry.ts`
- [ ] T006 [P] Implement `getThemeById()` utility function in `app/theme-prompts/registry.ts`
- [ ] T007 [P] Implement `getThemeByTemplateName()` utility function in `app/theme-prompts/registry.ts`
- [ ] T008 [P] Implement `getThemePrompt()` utility function in `app/theme-prompts/registry.ts`
- [ ] T009 [P] Implement `getThemeList()` utility function in `app/theme-prompts/registry.ts`
- [ ] T010 Add 12 restaurant templates to `STARTER_TEMPLATES` array (before existing templates) in `app/utils/constants.ts`

**Checkpoint**: Foundation ready. Verify: `pnpm run typecheck` passes, registry exports all functions.

---

## Phase 3: User Story 1+2 - Restaurant Theme Generation (Priority: P1) 🎯 MVP

**Goal**: Enable users to request restaurant websites and receive theme-appropriate generated content with intelligent cuisine/style matching.

**Independent Test**: Enter "create a Chinese restaurant website" and verify:
1. Template selection returns "Bamboo Bistro"
2. Theme prompt is injected into system prompt
3. Generated site follows Asian casual dining aesthetics

### Unit Tests for Registry (Optional)

- [ ] T011 [P] [US1] Create unit test for `getThemeById()` in `tests/unit/theme-registry.test.ts`
- [ ] T012 [P] [US1] Create unit test for `getThemeByTemplateName()` in `tests/unit/theme-registry.test.ts`
- [ ] T013 [P] [US1] Create unit test for `getThemePrompt()` in `tests/unit/theme-registry.test.ts`

### Implementation for User Story 1+2

- [ ] T014 [US1] Update template selection prompt with restaurant detection rules in `app/utils/selectStarterTemplate.ts`
- [ ] T015 [US1] Add restaurant-specific keywords and examples to selection prompt in `app/utils/selectStarterTemplate.ts`
- [ ] T016 [US1] Include template `category` and `tags` in selection prompt context in `app/utils/selectStarterTemplate.ts`
- [ ] T017 [US1] Add `restaurantThemeId` state to `ChatImpl` component in `app/components/chat/Chat.client.tsx`
- [ ] T018 [US1] Include `restaurantThemeId` in `useChat` hook's body option in `app/components/chat/Chat.client.tsx`
- [ ] T019 [US1] Update `sendMessage` to resolve theme ID from selected template in `app/components/chat/Chat.client.tsx`
- [ ] T020 [US1] Clear `restaurantThemeId` on template loading failures in `app/components/chat/Chat.client.tsx`
- [ ] T021 [US1] Add `restaurantThemeId` to request body destructuring in `app/routes/api.chat.ts`
- [ ] T022 [US1] Pass `restaurantThemeId` to main `streamText()` call in `app/routes/api.chat.ts`
- [ ] T023 [US1] Import `getThemePrompt` from registry in `app/lib/.server/llm/stream-text.ts`
- [ ] T024 [US1] Add `restaurantThemeId` to `streamText()` function props in `app/lib/.server/llm/stream-text.ts`
- [ ] T025 [US1] Inject theme prompt layer after base system prompt in `app/lib/.server/llm/stream-text.ts`
- [ ] T026 [US1] Add logging for theme application in `app/lib/.server/llm/stream-text.ts`
- [ ] T027 [US1] Add warning log for missing theme prompts in `app/lib/.server/llm/stream-text.ts`

**Checkpoint**: User Story 1+2 complete. Manual test: "create a chinese restaurant website" → Bamboo Bistro selected → theme styling applied.

---

## Phase 4: User Story 3 - Graceful Fallback (Priority: P2)

**Goal**: Ensure non-restaurant requests continue to work with generic templates without theme injection.

**Independent Test**: Enter "create a todo app" and verify:
1. Generic template (e.g., Vite React) is selected
2. No `restaurantThemeId` is set
3. No theme prompt injection occurs

### Implementation for User Story 3

- [ ] T028 [US3] Verify `restaurantThemeId` is `null` for blank template selection in `app/components/chat/Chat.client.tsx`
- [ ] T029 [US3] Verify theme injection guard checks `chatMode === 'build'` in `app/lib/.server/llm/stream-text.ts`
- [ ] T030 [US3] Verify existing generic templates in `STARTER_TEMPLATES` are unchanged in `app/utils/constants.ts`

**Checkpoint**: User Story 3 complete. Manual test: "build a todo app" → Vite React selected → no theme injection.

---

## Phase 5: User Story 4 - GitHub Template Loading (Priority: P2)

**Goal**: Successfully fetch restaurant template files from `neweb-learn` GitHub organization.

**Independent Test**: Select any restaurant template and verify files are fetched from the correct GitHub repo.

### Implementation for User Story 4

- [ ] T031 [US4] Verify all 12 `githubRepo` URLs in restaurant templates point to `neweb-learn` org in `app/utils/constants.ts`
- [ ] T032 [US4] Verify error handling clears `restaurantThemeId` on GitHub fetch failure in `app/components/chat/Chat.client.tsx`
- [ ] T033 [US4] Verify toast warning appears on rate limit or 404 errors in `app/components/chat/Chat.client.tsx`

**Checkpoint**: User Story 4 complete. Manual test: Template loads from GitHub, errors show toast.

---

## Phase 6: User Story 5 - Theme Context Persistence (Priority: P3)

**Goal**: Maintain restaurant theme context across conversation continuations when max tokens trigger continuation.

**Independent Test**: Generate a long restaurant website that triggers continuation and verify theme styling remains consistent.

### Implementation for User Story 5

- [ ] T034 [US5] Pass `restaurantThemeId` to continuation `streamText()` call (onFinish handler) in `app/routes/api.chat.ts`
- [ ] T035 [US5] Verify theme prompt is applied in continuation responses in `app/lib/.server/llm/stream-text.ts`

**Checkpoint**: User Story 5 complete. Manual test: Long generation with continuation → theme persists.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and documentation

- [ ] T036 Run `pnpm run typecheck` and fix any TypeScript errors
- [ ] T037 Run `pnpm run lint` and fix any linting issues
- [ ] T038 Run unit tests with `pnpm exec vitest run tests/unit/theme-registry.test.ts`
- [ ] T039 [P] Verify all 12 themes are selectable via appropriate prompts (manual E2E)
- [ ] T040 [P] Verify non-restaurant requests work unchanged (manual regression)
- [ ] T041 Update any relevant documentation if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories
- **Phase 3 (US1+US2)**: Depends on Phase 2 completion
- **Phase 4 (US3)**: Depends on Phase 3 completion (verification of fallback)
- **Phase 5 (US4)**: Depends on Phase 2 completion (can run parallel with US3)
- **Phase 6 (US5)**: Depends on Phase 3 completion (builds on API integration)
- **Phase 7 (Polish)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1: Setup (Types)
    ↓
Phase 2: Foundational (Registry + Constants)
    ↓
    ├─→ Phase 3: US1+US2 (Core Generation) ─→ Phase 4: US3 (Fallback) ─→ Phase 7
    │                                    └─→ Phase 6: US5 (Persistence) ─┘
    └─→ Phase 5: US4 (GitHub Loading) ────────────────────────────────────┘
```

### Within Each Phase

- Tasks marked [P] can run in parallel
- Non-[P] tasks should be done sequentially
- T004-T005 must complete before T006-T009
- T014-T016 are related and should be done together
- T017-T020 are Chat.client.tsx changes - do together
- T021-T022 are api.chat.ts changes - do together
- T023-T027 are stream-text.ts changes - do together

### Parallel Opportunities

**Phase 1** (all parallel):
```
T001: Create RestaurantThemeId type
T002: Create RestaurantTheme interface
(then T003 depends on T001)
```

**Phase 2** (after T004-T005):
```
T006: getThemeById()
T007: getThemeByTemplateName()
T008: getThemePrompt()
T009: getThemeList()
```

**Phase 3 Tests** (all parallel):
```
T011: Test getThemeById
T012: Test getThemeByTemplateName
T013: Test getThemePrompt
```

---

## Parallel Example: Phase 2 Foundation

```bash
# After T004-T005 complete, launch utility functions in parallel:
Task: "Implement getThemeById() in app/theme-prompts/registry.ts"
Task: "Implement getThemeByTemplateName() in app/theme-prompts/registry.ts"
Task: "Implement getThemePrompt() in app/theme-prompts/registry.ts"
Task: "Implement getThemeList() in app/theme-prompts/registry.ts"
```

## Parallel Example: Phase 3 by File

```bash
# Implementation can be parallelized by file:
File 1: app/utils/selectStarterTemplate.ts (T014-T016)
File 2: app/components/chat/Chat.client.tsx (T017-T020)
File 3: app/routes/api.chat.ts (T021-T022)
File 4: app/lib/.server/llm/stream-text.ts (T023-T027)

# Then integrate and test together
```

---

## Implementation Strategy

### MVP First (User Story 1+2 Only)

1. Complete Phase 1: Setup (~10 min)
2. Complete Phase 2: Foundational (~45 min)
3. Complete Phase 3: US1+US2 (~1.5 hours)
4. **STOP and VALIDATE**: Test restaurant generation independently
5. Deploy/demo if ready - this is the MVP!

### Incremental Delivery

1. Setup + Foundational → Foundation ready (~1 hour)
2. Add US1+US2 → Test → **MVP Complete** (~1.5 hours)
3. Add US3 (Fallback verification) → Test (~15 min)
4. Add US4 (GitHub verification) → Test (~15 min)
5. Add US5 (Persistence) → Test (~30 min)
6. Polish → Final verification (~30 min)

### Single Developer Flow

1. T001-T003 (Types) → typecheck
2. T004-T010 (Registry + Constants) → typecheck
3. T011-T013 (Tests) → run tests, expect pass
4. T014-T027 (Core Implementation) → typecheck
5. Manual E2E test: "chinese restaurant" → theme applied
6. T028-T035 (Verification tasks)
7. T036-T041 (Polish)

---

## Task Summary

| Phase | Tasks | Parallel | Est. Time |
|-------|-------|----------|-----------|
| Phase 1: Setup | 3 | 2 | 10 min |
| Phase 2: Foundational | 7 | 4 | 45 min |
| Phase 3: US1+US2 | 17 | 6 | 1.5 hours |
| Phase 4: US3 | 3 | 0 | 15 min |
| Phase 5: US4 | 3 | 0 | 15 min |
| Phase 6: US5 | 2 | 0 | 30 min |
| Phase 7: Polish | 6 | 2 | 30 min |
| **Total** | **41** | **14** | **~4 hours** |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US1 and US2 are combined since they're both P1 and tightly coupled
- US3, US4, US5 are mostly verification of behavior implemented in US1+US2
- Reference `docs/architecture/templates-and-prompts.md` for detailed code snippets
- Reference `specs/001-restaurant-theme-integration/quickstart.md` for step-by-step guide

