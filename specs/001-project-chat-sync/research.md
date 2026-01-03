# Research: Project Chat Sync

**Date**: 2025-12-30  
**Branch**: `001-project-chat-sync`  
**Spec**: [`spec.md`](./spec.md)

## Current State (What already exists in the codebase)

### Client persistence

- **IndexedDB cache**: `app/lib/persistence/db.ts` stores chats in IndexedDB database `boltHistory` (object stores: `chats`, `snapshots`).
- **Read path**: `app/lib/persistence/useChatHistory.ts` attempts server load first when:
  - `projectId` exists AND
  - `isUserAuthenticated()` (currently checks Better Auth session cookie).
  - Falls back to local IndexedDB with a warning toast.
- **Write path**: `storeMessageHistory()` always writes to IndexedDB. If authenticated and `projectId` exists, it also posts messages to the server and shows a warning toast on failure.

### Server persistence

- **Database tables** (Supabase migrations): `supabase/migrations/20251217000000_projects_schema.sql`
  - `projects`
  - `project_messages` (unique per `(project_id, sequence_num)` and `(project_id, message_id)`)
  - `project_snapshots`
- **API routes**:
  - `GET/POST /api/projects/:id/messages` (`app/routes/api.projects.$id.messages.ts`)
  - `GET/PUT /api/projects/:id/snapshot` (used from `db.ts` server snapshot functions)
- **Server services**:
  - `getMessagesByProjectId()` and `saveMessages()` in `app/lib/services/projects.server.ts`
  - `getMessagesByProjectId()` supports `limit`, `offset`, and `order` (by `sequence_num`).

## Gaps vs the updated spec (what we must add/change)

### 1) Recent-first load with “Load older messages”

Current `getServerMessages()` calls `loadAllMessages()` which loads *all* pages. The spec requires:

- Load the most recent portion on open
- Fetch older pages only when user asks

### 2) “Not yet synced” labeling and background sync after sign-in / recovery

Current behavior:

- If server save fails, we show a toast warning but do not persist a durable “pending sync” marker per message.

Spec requires:

- Messages created while signed out or during failure must be stored locally and **clearly labeled** as not yet synced.
- Automatic sync begins when sign-in happens or service recovers.

### 3) Concurrent sessions with “merge only” semantics (no overwrites)

Current server write behavior uses `upsert(..., onConflict: 'project_id,sequence_num')`. If two sessions independently compute `sequence_num` for new messages (e.g., both append one message to the same base history), they can produce the same `sequence_num` for different `message_id` values. With `onConflict: project_id,sequence_num`, this can overwrite a different message, violating “merge, no overwrites”.

## Key Decisions

### Decision 1: Use recent-first server reads (descending order) + incremental “load older”

- **Chosen**: Call `GET /api/projects/:id/messages` with `order=desc` and `limit=PAGE_SIZE` for initial load; then increase `offset` and repeat for “load older”.
- **Rationale**: API already supports `order` and `offset`. This requires minimal server change and provides predictable paging.
- **Alternatives considered**:
  - Cursor-based paging (better for very large histories) — more complex API changes; can be added later if needed.
  - Load all on open — conflicts with the clarified spec and can be slow.

### Decision 2: Keep messages immutable; dedupe by `message_id` everywhere

- **Chosen**: Treat each message as immutable. The canonical identity is `(project_id, message_id)`.
- **Rationale**: Immutability simplifies merge semantics and prevents accidental overwrites.
- **Implication**: Server write endpoints should not update message content for existing `message_id`.

### Decision 3: Add an append-only server write path (safe for concurrent sessions)

- **Chosen**: Add a new server endpoint: `POST /api/projects/:id/messages/append` that inserts *only new* messages (by `message_id`) and allocates `sequence_num` safely on the server.
- **Rationale**: This avoids the core overwrite risk from `sequence_num` collisions and avoids sending the full history on every message.
- **Implementation approach**:
  - Add a database function (migration) that:
    - acquires a per-project lock (e.g., `pg_advisory_xact_lock`)
    - computes `next_sequence_num` from current max
    - inserts messages with `ON CONFLICT (project_id, message_id) DO NOTHING`
  - The API route calls this function through the authenticated Supabase client.
- **Alternatives considered**:
  - Change schema to drop unique `(project_id, sequence_num)` and sort by `created_at` — larger migration + compatibility risks.
  - Keep current upsert-by-seq and accept collisions — violates spec and risks data loss.

### Decision 4: “Pending sync” is stored locally and surfaced in the UI

- **Chosen**: Persist a per-message “pending” marker locally (IndexedDB) and show:
  - a global sync banner (state: synced/syncing/pending/error/signed-out)
  - and per-message pending indicator for unsynced items
- **Rationale**: Meets spec clarity requirements without blocking chat.
- **Alternatives considered**:
  - Toast-only — insufficiently durable/visible for “not yet synced”.

### Decision 5: Clear history is a first-class API action

- **Chosen**: Add `DELETE /api/projects/:id/messages` to delete all `project_messages` rows for that project (scoped by user access), and clear the local cache for that project.
- **Rationale**: Provides a clean, testable behavior and avoids client-side “fake delete”.

## Risks & Mitigations

- **Risk: DB function + lock complexity**
  **Mitigation**: Keep function small; unit test server route behavior; document lock rationale; prefer insert-only semantics.

- **Risk: Large histories + offset paging performance**
  **Mitigation**: Load recent only by default; cap page size; consider cursor paging later.

- **Risk: Dual sources (server + IndexedDB) create confusion**
  **Mitigation**: Explicit sync banner + per-message pending indicator; deterministic merge by `message_id`.

## Implementation Notes (Added during Phase 1 Setup)

**Date**: 2025-12-30

### Current Behavior (Baseline before changes)

**On project open (signed in)**:
1. `useChatHistory` hook in `app/lib/persistence/useChatHistory.ts` checks if user is authenticated and `projectId` exists
2. If yes, calls `getServerMessages()` from `app/lib/persistence/db.ts`
3. `getServerMessages()` calls `loadAllMessages()` which fetches ALL pages from server using pagination
4. Falls back to local IndexedDB if server fetch fails (shows warning toast)
5. Messages are displayed in chronological order by `sequence_num`

**On message send (signed in)**:
1. New message added to local state immediately
2. `storeMessageHistory()` writes to IndexedDB
3. If authenticated + `projectId` exists, posts ALL messages to server via `POST /api/projects/:id/messages`
4. Server uses `upsert` with `onConflict: 'project_id,sequence_num'` - can overwrite if sequence numbers collide

**On project open (signed out)**:
1. Loads from local IndexedDB only
2. No sync to server

**On message send (signed out)**:
1. Writes to IndexedDB only
2. No pending marker or retry mechanism
3. Messages are lost unless user manually syncs after sign-in

### Expected Changes (Phase 1 implementation plan)

**Setup artifacts created**:
- `app/lib/persistence/chatSyncConstants.ts` - Shared constants (page size, annotation keys, retry config)
- `app/lib/persistence/messageSyncTypes.ts` - TypeScript types for sync state
- `app/components/chat/LoadOlderMessagesButton.tsx` - UI skeleton for load-older functionality
- `app/components/chat/ChatSyncStatusBanner.tsx` - UI skeleton for sync status display

**Next phases will change**:
- Initial load will fetch RECENT messages only (not all pages)
- "Load older messages" button will appear when more history exists
- New `/api/projects/:id/messages/append` endpoint for safe concurrent writes
- Pending sync markers for offline/failed messages
- Background sync with retry logic
- Clear history functionality
