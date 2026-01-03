# Tasks: Project Chat Sync

**Input**: Design documents from `specs/001-project-chat-sync/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required), plus `research.md`, `data-model.md`, `contracts/project-messages-api.yaml`, `quickstart.md`

**Note on tests**: The plan includes correctness/performance gates; this task list includes unit/integration tests to reduce rework risk.

## Phase 1: Setup (Shared Infrastructure) ✅

**Purpose**: Create the minimal scaffolding and shared constants so subsequent work is consistent and low-risk.

- [X] T001 [P] Add chat sync constants (page size, pending marker string) in `app/lib/persistence/chatSyncConstants.ts`
- [X] T002 [P] Add a small type helper for "pending sync" annotations in `app/lib/persistence/messageSyncTypes.ts`
- [X] T003 [P] Add placeholder "Load older messages" UI component skeleton in `app/components/chat/LoadOlderMessagesButton.tsx`
- [X] T004 [P] Add placeholder sync status UI component skeleton in `app/components/chat/ChatSyncStatusBanner.tsx`
- [X] T005 Add baseline notes (current behavior + expected changes) in `specs/001-project-chat-sync/research.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared correctness/security fixes needed before any user story changes are safe.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T006 Tighten message request validation to accept JSON content + preserve annotations in `app/routes/api.projects.$id.messages.ts`
- [X] T007 [P] Ensure server-side `saveMessages` preserves `message_id` uniqueness (no silent overwrites) by updating docs/comments in `app/lib/services/projects.server.ts`
- [X] T008 [P] Update client → server mapping to include `annotations` when posting messages in `app/lib/persistence/db.ts`
- [X] T009 [P] Add a small helper to normalize/strip local-only annotations before sending to server in `app/lib/persistence/db.ts`
- [X] T010 [P] Add/refresh unit coverage for message merge by `message_id` in `tests/unit/messageMerge.test.ts`

**Checkpoint**: Foundation ready (validated input parsing + annotation preservation) — user story implementation can now begin.

---

## Phase 3: User Story 1 - Reopen a project and continue the conversation (Priority: P1) 🎯 MVP

**Goal**: On project open, load recent project history from backend quickly; allow user to continue chatting; provide explicit “Load older messages” to fetch more.

**Independent Test**: Open a project with many messages → see recent history quickly → click “Load older messages” → older messages prepend correctly → send a new message → message persists and still shows after reload.

### Server-side (messages API + safe append)

- [X] T011 [US1] Add new Supabase migration with append-only RPC function in `supabase/migrations/20251230000000_append_project_messages.sql`
- [X] T012 [US1] Add server service wrapper for append RPC (`appendMessages`, `getRecentMessages`) in `app/lib/services/projects.server.ts`
- [X] T013 [US1] Implement append endpoint route in `app/routes/api.projects.$id.messages.append.ts`
- [X] T014 [P] [US1] Add request/response Zod schemas for append endpoint in `app/routes/api.projects.$id.messages.append.ts`
- [X] T015 [P] [US1] Add server logging (append inserts, dedupe count) in `app/routes/api.projects.$id.messages.append.ts`
- [X] T016 [P] [US1] Add GET endpoint for recent messages in `app/routes/api.projects.$id.messages.recent.ts`

### Client-side (recent-first load + load older)

- [ ] T017 [US1] Add `order` support to paginated message fetch in `app/lib/persistence/messageLoader.ts`
- [ ] T018 [P] [US1] Add `fetchMessagePage(projectId, offset, limit, order)` signature update in `app/lib/persistence/messageLoader.ts`
- [ ] T019 [P] [US1] Add `loadRecentMessages(projectId, limit)` helper returning `{ messages, total }` in `app/lib/persistence/messageLoader.ts`
- [ ] T020 [P] [US1] Add `loadOlderMessagesPage(projectId, offset, limit)` helper returning `{ messages, total }` in `app/lib/persistence/messageLoader.ts`
- [ ] T021 [US1] Update `getServerMessages` to load *recent only* (not all pages) in `app/lib/persistence/db.ts`
- [ ] T022 [US1] Add `getServerMessagesPage` for on-demand older paging in `app/lib/persistence/db.ts`
- [ ] T023 [US1] Update `useChatHistory(projectId)` to track `totalServerMessages`, `loadedServerMessages`, and `hasOlderMessages` in `app/lib/persistence/useChatHistory.ts`
- [ ] T024 [US1] Expose `loadOlderMessages()` callback from `useChatHistory` in `app/lib/persistence/useChatHistory.ts`
- [ ] T025 [US1] Implement “Load older messages” button rendering + wiring in `app/components/chat/Chat.client.tsx`
- [ ] T026 [P] [US1] Implement `LoadOlderMessagesButton` UI (loading/disabled/error) in `app/components/chat/LoadOlderMessagesButton.tsx`
- [ ] T027 [US1] Ensure older pages prepend in correct chronological order in `app/components/chat/Chat.client.tsx`
- [ ] T028 [P] [US1] Add UX toast on older-page load failure in `app/components/chat/Chat.client.tsx`

### Client-side (write path uses append endpoint)

- [X] T029 [US1] Add `appendServerMessages(projectId, messages)` client function in `app/lib/persistence/db.ts`
- [X] T030 [US1] Switch `storeMessageHistory` to prefer append endpoint (dedupe by message_id; no overwrites) in `app/lib/persistence/useChatHistory.ts`
- [X] T031 [P] [US1] Ensure server write only includes messages that are not `no-store` in `app/lib/persistence/useChatHistory.ts`
- [X] T032 [P] [US1] Ensure append payload preserves `createdAt` where available in `app/lib/persistence/db.ts`

### Tests (US1)

- [X] T033 [P] [US1] Unit test recent-first pagination (order=desc + reverse for display) in `tests/unit/messageLoader.test.ts`
- [X] T034 [P] [US1] Unit test "load older" merges pages without duplicates in `tests/unit/messageLoader.test.ts`
- [X] T035 [US1] Integration test: open project → shows recent → load older → send message → reload preserves history in `tests/integration/projectChatSync.test.ts`

**Checkpoint**: US1 works end-to-end (recent load, load older, continue chatting, safe server sync).

---

## Phase 4: User Story 2 - Access the same project chat from another device/session (Priority: P2)

**Goal**: When signed in from a second session, opening the same project shows the same server-backed chat history.

**Independent Test**: Session A sends messages → Session B opens the same project → sees the same history and can continue.

- [X] T036 [US2] Ensure project open passes `projectId` to `useChatHistory` in `app/components/chat/Chat.client.tsx`
- [X] T037 [P] [US2] Add "session B" manual test notes in `specs/001-project-chat-sync/quickstart.md`
- [X] T038 [US2] Integration test: "session A writes, session B reads" via API-level simulation in `tests/integration/projectChatSync.test.ts`

**Checkpoint**: US2 confirmed (cross-session consistency while signed in).

---

## Phase 5: User Story 3 - Keep working when sync is temporarily unavailable (Priority: P3)

**Goal**: Signed-out or temporary failures still allow chatting locally with clear “not yet synced” indicators, with retry + automatic sync on recovery.

**Independent Test**: Go offline or sign out → open project → chat locally (pending markers) → sign in / go online → pending messages sync and markers clear.

### Signed-out open should not hard-fail the route

- [X] T039 [US3] Adjust signed-out handling to fall back to local chat (no 401 hard-fail) in `app/routes/chat.$id.tsx`

### Pending sync state (durable, user-visible)

- [X] T040 [US3] Implement sync-state helpers (mark pending, clear pending, compute banner state) in `app/lib/persistence/messageSyncState.ts`
- [X] T041 [P] [US3] Add unit tests for sync-state transitions in `tests/unit/chatSyncState.test.ts`
- [X] T042 [US3] Mark new messages as pending when signed out in `app/lib/persistence/useChatHistory.ts`
- [X] T043 [US3] Mark new messages as pending when server append fails in `app/lib/persistence/useChatHistory.ts`
- [X] T044 [US3] Clear pending markers after successful append sync in `app/lib/persistence/useChatHistory.ts`

### Retry + background sync on recovery

- [X] T045 [US3] Add `retrySync()` action that attempts to append pending messages in `app/lib/persistence/useChatHistory.ts`
- [X] T046 [US3] Add background sync effect that runs when auth becomes available in `app/lib/persistence/useChatHistory.ts`
- [X] T047 [P] [US3] Add exponential backoff helper reuse for background sync retries in `app/lib/utils/retry.ts`

### UI: status banner + per-message "not yet synced" indicator

- [X] T048 [US3] Render sync status banner (signed-out / pending / error / syncing / up-to-date) in `app/components/chat/Chat.client.tsx`
- [X] T049 [P] [US3] Implement banner UI + retry button in `app/components/chat/ChatSyncStatusBanner.tsx`
- [X] T050 [US3] Add per-message pending indicator in `app/components/chat/UserMessage.tsx`
- [X] T051 [P] [US3] Add per-message pending indicator in `app/components/chat/AssistantMessage.tsx`
- [X] T052 [P] [US3] Ensure pending marker annotation is not displayed as user content in `app/components/chat/Messages.client.tsx`

### Tests (US3)

- [X] T053 [US3] Integration test: server unavailable → local fallback + pending markers visible in `tests/integration/projectChatSync.test.ts`
- [X] T054 [US3] Integration test: recovery → pending messages sync → markers clear in `tests/integration/projectChatSync.test.ts`

**Checkpoint**: US3 complete (offline/signed-out resilience with clear pending + retry + auto-recovery).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Clear history feature + hardening, performance, and doc validation.

### Clear chat history (server + local)

- [X] T055 Add `DELETE /api/projects/:id/messages` support in `app/routes/api.projects.$id.messages.ts`
- [X] T056 Add server service function to delete messages and return count in `app/lib/services/projects.server.ts`
- [X] T057 [P] Add client function `clearServerMessages(projectId)` in `app/lib/persistence/db.ts`
- [X] T058 Add "Clear chat history" UI action + confirmation modal in `app/components/chat/Chat.client.tsx`
- [X] T059 [P] Clear local IndexedDB messages/snapshots for the chat in `app/lib/persistence/db.ts`
- [X] T060 Integration test: clear history removes server + local and stays empty on reopen in `tests/integration/projectChatSync.test.ts`

### Performance + reliability hardening

- [X] T061 Remove/replace noisy `console.log` calls with scoped logger where appropriate in `app/lib/persistence/useChatHistory.ts`
- [X] T062 [P] Ensure load-older button is disabled while streaming/typing to avoid UI jank in `app/components/chat/Messages.client.tsx`
- [X] T063 [P] Ensure message page size and max limits are consistent across loader + server route in `app/lib/persistence/chatSyncConstants.ts`
- [X] T064 Add guardrails for very large chat history (stop after N pages until user continues) in `app/lib/persistence/useChatHistory.ts`

### Docs validation

- [X] T065 Validate the end-to-end flows in `specs/001-project-chat-sync/quickstart.md` and update any mismatches in `specs/001-project-chat-sync/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational.
- **Polish (Phase 6)**: Depends on completing the desired user stories (at minimum US1).

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — delivers MVP.
- **US2 (P2)**: Depends on US1 server sync correctness (read/write) but is otherwise additive.
- **US3 (P3)**: Builds on US1; adds failure-mode UX and durable pending markers.

### Parallel Opportunities

- [P] tasks in Setup/Foundational can run in parallel (different files).
- Within US1, server tasks (migration/service/route) can proceed in parallel with client pagination work until the integration wiring step.
- Tests marked [P] can run in parallel once their referenced code stubs exist.

---

## Parallel Example: US1 (after Foundational)

```text
Run in parallel:
- T011 (migration) in supabase/migrations/20251230000000_append_project_messages.sql
- T013 (append route) in app/routes/api.projects.$id.messages.append.ts
- T017 (order support) in app/lib/persistence/messageLoader.ts
- T026 (button UI) in app/components/chat/LoadOlderMessagesButton.tsx
```

---

## Implementation Strategy (MVP-first)

- **MVP = US1**: recent load + load older + safe append sync.
- **Then US2**: validate cross-session behavior.
- **Then US3**: signed-out/offline resilience + pending markers + retry.
- **Finally**: clear history + polish/hardening.

