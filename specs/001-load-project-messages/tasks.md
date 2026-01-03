# Tasks: Load Project Messages on Open

**Feature**: 001-load-project-messages  
**Branch**: `001-load-project-messages`  
**Created**: 2025-12-27  
**Total Tasks**: 32  
**Estimated Time**: ~16 hours

---

## User Story Summary

| Story | Priority | Description | Task Count |
|-------|----------|-------------|------------|
| US1 | P1 | Load Complete Chat History | 8 tasks |
| US2 | P2 | Handle Large Message Volumes (UI/UX) | 7 tasks |
| US3 | P3 | Fallback to Local Storage | 5 tasks |
| Setup | - | Types and utilities | 5 tasks |
| Foundational | - | Core loader module | 4 tasks |
| Polish | - | Integration & testing | 3 tasks |

---

## Phase 1: Setup

**Goal**: Create foundational types and utilities required by all user stories.

### Tasks

- [X] T001 [P] Create message loading types in `app/types/message-loading.ts`
  - Define `LoadingPhase` type: 'idle' | 'server' | 'partial' | 'local' | 'merging' | 'complete' | 'error'
  - Define `MessageLoadingState` interface with phase, loaded, total, error, isPartial, retryCount
  - Define `MessageLoadProgress` interface for progress callbacks
  - Define `MessageLoaderOptions` interface with pageSize, maxRetries, baseDelay, maxDelay
  - Define `MessageLoadResult` and `MergeResult` interfaces
  - Export `initialLoadingState` constant

- [X] T002 [P] Create exponential backoff utility in `app/lib/utils/backoff.ts`
  - Implement `calculateBackoff(attempt: number, config: BackoffConfig): number`
  - Add jitter factor to prevent thundering herd
  - Export `BackoffConfig` interface
  - Default config: baseDelay=1000, maxDelay=30000, jitterFactor=0.1

- [X] T003 [P] Create message validation utility in `app/lib/persistence/messageValidation.ts`
  - Implement `isValidMessage(msg: unknown): msg is Message` type guard
  - Validate required fields: id (string), role (user|assistant|system), content
  - Export for use in loader and merge functions

- [X] T004 [P] Create message sorting utility in `app/lib/persistence/messageSort.ts`
  - Implement `sortMessagesBySequence(messages: Message[]): Message[]`
  - Primary sort: `sequence_num` ascending
  - Secondary sort: `created_at` ascending for ties
  - Handle missing sequence_num (assign to end)

- [X] T005 Export new utilities from `app/lib/persistence/index.ts`
  - Add exports for messageValidation, messageSort
  - Maintain existing exports

---

## Phase 2: Foundational

**Goal**: Create core message loader module that all user stories depend on.

**BLOCKING**: Must complete before Phase 3-5.

### Tasks

- [X] T006 Create `app/lib/persistence/messageLoader.ts` module structure
  - Import types from `~/types/message-loading`
  - Import `calculateBackoff` from utils
  - Import `createScopedLogger` for logging
  - Define module-level logger

- [X] T007 Implement `fetchMessagePage` function in `app/lib/persistence/messageLoader.ts`
  - Fetch single page from `/api/projects/${projectId}/messages`
  - Accept `projectId`, `offset`, `limit` parameters
  - Return `{ messages: ProjectMessage[], total: number }`
  - Handle HTTP errors, throw for non-2xx responses
  - Convert API response to AI SDK Message format

- [X] T008 Implement `loadAllMessages` function in `app/lib/persistence/messageLoader.ts`
  - Accept `projectId` and `MessageLoaderOptions`
  - Implement pagination loop: while offset < total
  - Call `fetchMessagePage` for each page
  - Handle 429 rate limiting with exponential backoff
  - Return partial results if max retries exceeded
  - Emit progress via `onProgress` callback
  - Log pagination progress

- [X] T009 Add unit tests for messageLoader in `tests/unit/messageLoader.test.ts`
  - Test: fetches all pages sequentially
  - Test: handles 429 rate limiting with backoff
  - Test: returns partial results after max retries
  - Test: calls onProgress callback with correct values
  - Test: handles empty response (0 messages)
  - Mock fetch for all tests

---

## Phase 3: User Story 1 - Load Complete Chat History (P1)

**Goal**: When user opens a project, load ALL messages from server (not just first 50).

**Independent Test**: Open a project with 100+ messages, verify all messages appear in correct order.

**Acceptance Criteria**:
- AC1: All messages load regardless of count (tested with 100+ messages)
- AC2: Messages display in correct chronological order (by sequence_num)
- AC3: Message metadata preserved (role, annotations, timestamps)

### Tasks

- [X] T010 [US1] Update `getServerMessages` signature in `app/lib/persistence/db.ts`
  - Add optional `onProgress` callback parameter
  - Update return type to include partial flag
  - Keep backward compatibility with existing callers

- [X] T011 [US1] Replace `getServerMessages` implementation in `app/lib/persistence/db.ts`
  - Import `loadAllMessages` from `./messageLoader`
  - Call `loadAllMessages` with pageSize=100, maxRetries=3
  - Pass through `onProgress` callback
  - Convert result to `ChatHistoryItem` format
  - Return null if no messages

- [X] T012 [US1] Update `loadMessages` function in `app/lib/persistence/useChatHistory.ts`
  - Call updated `getServerMessages` with progress callback
  - Store messages in state as they load
  - Log loading progress for debugging

- [X] T013 [US1] Add message ordering in `app/lib/persistence/useChatHistory.ts`
  - Import `sortMessagesBySequence` utility
  - Sort messages after loading completes
  - Ensure consistent order across reloads

- [X] T014 [US1] Preserve message annotations in `app/lib/persistence/db.ts`
  - Map `annotations` field from API response
  - Handle null/undefined annotations
  - Ensure hidden message markers preserved

- [X] T015 [US1] Add unit tests for getServerMessages in `tests/unit/db.test.ts`
  - Test: loads all messages via pagination
  - Test: calls onProgress with correct values
  - Test: returns null for empty project
  - Test: preserves message metadata

- [ ] T016 [US1] Add integration test for complete message loading in `tests/integration/project-messages.test.ts`
  - Setup: Create project with 150+ messages in test DB
  - Test: Open project, verify all 150 messages load
  - Test: Verify message order matches sequence_num
  - Cleanup: Delete test project

- [ ] T017 [US1] Manual verification checkpoint
  - Create test project with 100+ messages
  - Open project via `/chat/{url_id}`
  - Verify all messages appear
  - Verify correct chronological order

---

## Phase 4: User Story 2 - Handle Large Message Volumes (P2)

**Goal**: Users with long chat histories see loading feedback and no UI freezing.

**Independent Test**: Load project with 500+ messages, measure load time <5s, verify progress indicator.

**Acceptance Criteria**:
- AC1: Skeleton UI displays immediately while loading
- AC2: Progress indicator shows "Loading X of Y messages"
- AC3: UI remains responsive during load (no freeze >100ms)
- AC4: Empty state displays when project has 0 messages

### Tasks

- [ ] T018 [P] [US2] Create `MessageSkeleton.tsx` in `app/components/chat/MessageSkeleton.tsx`
  - Accept `count` prop (default: 6)
  - Render alternating user/assistant skeleton bubbles
  - Use `animate-pulse` for shimmer effect
  - Match actual message bubble dimensions and styling
  - Use bolt design system classes

- [ ] T019 [P] [US2] Create `LoadingProgress.tsx` in `app/components/chat/LoadingProgress.tsx`
  - Accept `loaded` and `total` props
  - Calculate percentage: `(loaded / total) * 100`
  - Render progress bar with bolt-elements-accent color
  - Show text: "Loading X of Y messages" when total known
  - Show text: "Loading messages..." when total unknown
  - Handle edge cases: total=0, total=null

- [ ] T020 [P] [US2] Create `EmptyProjectState.tsx` in `app/components/chat/EmptyProjectState.tsx`
  - Render friendly empty state illustration/icon
  - Show message: "No messages yet. Start a conversation!"
  - Include visual prompt to encourage first message
  - Use bolt design system styling

- [ ] T021 [US2] Add loading state to `useChatHistory` hook in `app/lib/persistence/useChatHistory.ts`
  - Add `loadingState` state with `MessageLoadingState` type
  - Initialize to `initialLoadingState`
  - Update phase during loading: idle → server → partial → complete
  - Update `loaded` and `total` from progress callback
  - Export `loadingState` from hook return

- [ ] T022 [US2] Update `Chat.client.tsx` to handle loading states in `app/components/chat/Chat.client.tsx`
  - Import `MessageSkeleton`, `LoadingProgress`, `EmptyProjectState`
  - Check `loadingState.phase` before rendering
  - Phase 'server' + loaded=0: Show skeleton + indeterminate progress
  - Phase 'partial': Show loaded messages + progress bar
  - Phase 'complete' + messages=0: Show empty state
  - Phase 'complete' + messages>0: Normal render
  - Phase 'error': Show error state with retry button

- [ ] T023 [US2] Add loading progress to Chat UI in `app/components/chat/Chat.client.tsx`
  - Position progress bar at bottom of chat area
  - Animate progress smoothly with CSS transitions
  - Hide progress when loading complete
  - Show "Loading paused, retrying..." when rate limited

- [ ] T024 [US2] Manual performance verification
  - Create test project with 500 messages
  - Measure time from navigation to all messages visible
  - Verify <5 seconds target met
  - Verify UI responsive during load (scroll, type)
  - Verify skeleton displays immediately

---

## Phase 5: User Story 3 - Fallback to Local Storage (P3)

**Goal**: Users can access locally cached messages when server is unavailable.

**Independent Test**: Simulate offline, verify local messages load with warning toast.

**Acceptance Criteria**:
- AC1: Local messages display when server unavailable
- AC2: Warning toast shows when falling back to local
- AC3: Server messages take precedence, local-only preserved
- AC4: No data loss during merge

### Tasks

- [ ] T025 [P] [US3] Create `mergeMessages` function in `app/lib/persistence/messageMerge.ts`
  - Accept `serverMessages` and `localMessages` arrays
  - Build Set of server message IDs for O(1) lookup
  - Filter local messages not in server set
  - Concatenate: server messages + local-only messages
  - Sort merged result by sequence_num
  - Assign sequence_num to local-only messages (max + 1 + index)
  - Return `MergeResult` with counts

- [ ] T026 [US3] Update `loadMessages` in `app/lib/persistence/useChatHistory.ts` to merge
  - After server load succeeds, fetch local messages
  - If local messages exist, call `mergeMessages`
  - Update state with merged result
  - Log merge statistics

- [ ] T027 [US3] Add server fallback handling in `app/lib/persistence/useChatHistory.ts`
  - Catch server load errors
  - Set loading phase to 'local'
  - Load from IndexedDB via existing `getMessages`
  - Show warning toast: "Loaded from local cache"
  - Set `isPartial: true` in loading state

- [ ] T028 [US3] Add offline indicator in `app/components/chat/Chat.client.tsx`
  - Check if `loadingState.source === 'local'`
  - Show subtle banner: "Offline - showing cached messages"
  - Use warning color from design system

- [ ] T029 [US3] Add unit tests for mergeMessages in `tests/unit/messageMerge.test.ts`
  - Test: server-only messages returned unchanged
  - Test: local-only messages appended
  - Test: duplicates removed (by message_id)
  - Test: merged result sorted by sequence_num
  - Test: local-only get correct sequence_num assigned
  - Test: empty server returns all local
  - Test: empty local returns all server

---

## Phase 6: Polish & Integration

**Goal**: Final integration, edge cases, and cross-cutting concerns.

### Tasks

- [ ] T030 Handle edge case: user types during load in `app/components/chat/Chat.client.tsx`
  - Allow text input while loading
  - Queue new message submission until load completes
  - Or: Allow immediate submission, append after load

- [ ] T031 Add comprehensive logging in `app/lib/persistence/messageLoader.ts`
  - Log: pagination start (projectId, pageSize)
  - Log: each page fetched (offset, count, total)
  - Log: rate limiting (attempt, delay)
  - Log: completion (total loaded, partial flag, duration)
  - Use `createScopedLogger('MessageLoader')`

- [ ] T032 Final integration test in `tests/integration/project-messages.test.ts`
  - Test: Full flow from project open to all messages visible
  - Test: Offline fallback with local messages
  - Test: Empty project shows empty state
  - Test: Rate limiting shows partial then completes
  - Measure: Load time for 500 messages <5s

---

## Dependency Graph

```text
Phase 1 (Setup)
├── T001 Types ─────────────────────────────────────────────┐
├── T002 Backoff utility ──────────────┐                    │
├── T003 Message validation ───────────┼───────────────────┐│
├── T004 Message sorting ──────────────┼───────────────────┼┤
└── T005 Exports ──────────────────────┘                   ││
                                                           ││
Phase 2 (Foundational) ◄───────────────────────────────────┘│
├── T006 Module structure ◄────────────────────────────────┘
├── T007 fetchMessagePage ◄── T006
├── T008 loadAllMessages ◄── T006, T007, T002
└── T009 Unit tests ◄── T008

Phase 3 (US1) ◄── Phase 2
├── T010 Signature update ◄── T008
├── T011 Implementation ◄── T010
├── T012 useChatHistory update ◄── T011
├── T013 Message ordering ◄── T012, T004
├── T014 Annotations ◄── T011
├── T015 Unit tests ◄── T011
├── T016 Integration test ◄── T012
└── T017 Manual verification ◄── T016

Phase 4 (US2) ◄── Phase 3
├── T018 MessageSkeleton [P] ◄── T001
├── T019 LoadingProgress [P] ◄── T001
├── T020 EmptyProjectState [P]
├── T021 Loading state hook ◄── T012, T001
├── T022 Chat.client.tsx ◄── T018, T019, T020, T021
├── T023 Progress UI ◄── T022
└── T024 Performance test ◄── T023

Phase 5 (US3) ◄── Phase 3
├── T025 mergeMessages [P] ◄── T003, T004
├── T026 Merge in useChatHistory ◄── T025, T012
├── T027 Fallback handling ◄── T026
├── T028 Offline indicator ◄── T027, T022
└── T029 Unit tests ◄── T025

Phase 6 (Polish) ◄── Phase 4, Phase 5
├── T030 Type during load ◄── T022
├── T031 Logging ◄── T008
└── T032 Final integration ◄── ALL
```

---

## Parallel Execution Opportunities

### Phase 1 (All parallel)
```
T001 ──┬── T002 ──┬── T003 ──┬── T004
       │          │          │
       └──────────┴──────────┴── T005 (after all)
```

### Phase 4 UI Components (Parallel)
```
T018 (Skeleton) ──┬
T019 (Progress) ──┼── T022 (Chat.client.tsx)
T020 (Empty) ─────┘
```

### Phase 5 Merge (Parallel with Phase 4)
```
T025 (mergeMessages) ── can run parallel with T018-T020
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)
For fastest path to value, implement only:
- Phase 1: T001-T005 (Setup)
- Phase 2: T006-T009 (Core loader)
- Phase 3: T010-T017 (US1)

**MVP Deliverable**: All messages load, no UI feedback yet.
**MVP Estimate**: ~8 hours

### Full Feature
Complete all phases for full experience:
- Phase 4 adds loading UX (skeleton, progress)
- Phase 5 adds offline resilience
- Phase 6 adds polish

**Full Deliverable**: Production-ready feature with all requirements.
**Full Estimate**: ~16 hours

---

## Test Plan Summary

| Test Type | Location | Coverage |
|-----------|----------|----------|
| Unit | `tests/unit/messageLoader.test.ts` | Pagination, backoff, progress |
| Unit | `tests/unit/db.test.ts` | getServerMessages |
| Unit | `tests/unit/messageMerge.test.ts` | Merge, deduplication |
| Integration | `tests/integration/project-messages.test.ts` | Full flow |
| Manual | N/A | Performance, UX verification |

### Commands

```bash
# Run all unit tests
pnpm exec vitest run tests/unit/

# Run specific test file
pnpm exec vitest run tests/unit/messageLoader.test.ts

# Run integration tests
pnpm exec vitest run tests/integration/

# Run all tests
pnpm run test
```

---

## File Checklist

### New Files to Create
- [ ] `app/types/message-loading.ts`
- [ ] `app/lib/utils/backoff.ts`
- [ ] `app/lib/persistence/messageLoader.ts`
- [ ] `app/lib/persistence/messageValidation.ts`
- [ ] `app/lib/persistence/messageSort.ts`
- [ ] `app/lib/persistence/messageMerge.ts`
- [ ] `app/components/chat/MessageSkeleton.tsx`
- [ ] `app/components/chat/LoadingProgress.tsx`
- [ ] `app/components/chat/EmptyProjectState.tsx`
- [ ] `tests/unit/messageLoader.test.ts`
- [ ] `tests/unit/messageMerge.test.ts`
- [ ] `tests/integration/project-messages.test.ts`

### Files to Modify
- [ ] `app/lib/persistence/db.ts`
- [ ] `app/lib/persistence/useChatHistory.ts`
- [ ] `app/lib/persistence/index.ts`
- [ ] `app/components/chat/Chat.client.tsx`

---

## Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Message completeness | 100% | Integration test with 150 messages |
| Load time (500 msgs) | <5 seconds | Manual test with timer |
| UI responsiveness | No freeze >100ms | Manual scroll/type during load |
| Offline fallback | Works | Network disable test |
| Progress accuracy | Matches total | Visual verification |

