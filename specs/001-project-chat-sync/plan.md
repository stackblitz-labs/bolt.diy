# Implementation Plan: Project Chat Sync

**Branch**: `[001-project-chat-sync]` | **Date**: 2025-12-30 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/001-project-chat-sync/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Sync each user’s per-project chat history to the backend while keeping an offline-first local cache. On project open, load the most recent messages quickly, allow “Load older messages” on demand, and continuously sync new messages in the background. When signed out or when sync fails, users can still chat locally with clear “not yet synced” status; messages are synced automatically after sign-in/recovery. Add a safe “Clear chat history” action that deletes server + local history for the project.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.7.x (Node.js >= 18.18)  
**Primary Dependencies**: Remix 2.15 + Vite 5.4, React 18, Better Auth, Supabase JS client, Vercel AI SDK (`ai`), nanostores, react-toastify  
**Storage**: Supabase/PostgreSQL (`projects`, `project_messages`, `project_snapshots`) + client IndexedDB (`boltHistory`)  
**Testing**: Vitest (`pnpm run test`) + TypeScript (`pnpm run typecheck`) + ESLint/Prettier (`pnpm run lint`)  
**Target Platform**: Cloudflare Pages (edge runtime constraints) + Electron (optional) + standard browsers (IndexedDB)  
**Project Type**: Web application (Remix app in `app/`)  
**Performance Goals**: Show restored *recent* chat within 2 seconds in ≥95% of project opens; “Load older messages” should stream pages without freezing UI  
**Constraints**: Offline-first behavior; do not lose messages when sync fails; Cloudflare Pages edge timeout ~30s for requests; strict TypeScript (no `any`); use Zod for API validation  
**Scale/Scope**: Practical support for thousands of messages per project; large histories load incrementally (recent first)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The repository constitution file is currently a placeholder and does not define enforceable gates. For this feature we will use the following gates as “project constitution”:

- **Gate A (Correctness)**: No message loss in common flows (reopen, offline, retry, multi-session) based on unit/integration tests.  
- **Gate B (Security)**: API requires authentication; server-side queries are scoped to the authenticated user; no cross-user leakage.  
- **Gate C (UX clarity)**: User can always see whether messages are synced or pending; retry is available; project can open even when offline.  
- **Gate D (Performance)**: Project open loads only recent history by default; older messages are fetched on demand.  
- **Gate E (Code quality)**: Strict TypeScript; no `any`; Zod for request bodies; no silent error swallowing (surface via toast + logs).

## Project Structure

### Documentation (this feature)

```text
specs/001-project-chat-sync/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Remix app (web)
app/
├── components/
│   └── chat/
│       ├── Chat.client.tsx
│       ├── Messages.client.tsx
│       └── (new) LoadOlderMessagesButton.tsx
├── lib/
│   ├── persistence/
│   │   ├── useChatHistory.ts
│   │   ├── messageLoader.ts
│   │   ├── messageMerge.ts
│   │   └── (new) messageSyncState.ts
│   └── services/
│       └── projects.server.ts
├── routes/
│   ├── api.projects.$id.messages.ts
│   └── (new) api.projects.$id.messages.append.ts
supabase/
└── migrations/
tests/
├── unit/
│   ├── messageLoader.test.ts
│   └── (new) chatSyncState.test.ts
└── integration/
    └── (new) projectChatSync.test.ts
```

**Structure Decision**: Use existing Remix `app/` architecture. Extend the existing persistence layer (`app/lib/persistence/*`) and API routes (`app/routes/*`) rather than introducing new services or packages.

## Phase 0: Research (output: `research.md`)

This phase documents the current implementation and resolves the key design decisions needed to meet the updated spec (recent-first loading, offline-first pending status, no-overwrite merge semantics).

Deliverable: [`research.md`](./research.md)

## Phase 1: Design & Contracts (outputs: `data-model.md`, `contracts/*`, `quickstart.md`)

Deliverables:

- [`data-model.md`](./data-model.md)
- `contracts/project-messages-api.yaml`
- [`quickstart.md`](./quickstart.md)

## Phase 2: Detailed Implementation Plan (for `/speckit.tasks`)

### UI/UX behavior (end-to-end)

- **Open project (signed in)**: load most recent messages from server quickly; show “Load older messages” if more exist; merge any local-only messages into view (marked “not yet synced”) and begin background sync of pending items.
- **Open project (signed out)**: load local cached messages only; allow sending; mark messages pending; on sign-in, background sync runs and pending markers clear.
- **Sync failure**: continue local-only; show persistent banner and per-message pending marker; automatic retry with exponential backoff + manual retry button.
- **Clear history**: confirmation modal; clears server messages for that project and clears local cache for that project.

### Backend/API behavior

- Existing `GET /api/projects/:id/messages` already supports `limit`, `offset`, `order`. We will use `order=desc` for recent-first.  
- Introduce an **append-only write path** that never overwrites existing messages and is safe for concurrent sessions.
- Add a server endpoint to clear chat history.

### Data correctness strategy

- **Immutability**: Treat chat messages as immutable (message_id is the canonical identifier).
- **Deduplication**: Dedupe by `message_id` on merge and on server inserts.
- **Concurrency**: Avoid “sequence_num collisions” by using an append-only insert strategy (see `research.md`).

### Testing strategy

- Unit tests for:
  - recent-first pagination behavior and “load older” merging
  - pending/unsynced sync state transitions
  - message merge dedupe rules
- Integration test for:
  - sign-in vs signed-out flows
  - offline failure + recovery syncing
  - clear-history behavior

## Detailed design (implementation-level)

### Client: recent-first loading + load older

**Goal**: Replace “load all messages on open” with “load recent first, then load older on demand”.

- Update `app/lib/persistence/messageLoader.ts`
  - Add support for `order` query param (`asc|desc`) in `fetchMessagePage()`.
  - Expose a helper to fetch a single page (already present) and keep `loadAllMessages()` for legacy/debug.
- Update `app/lib/persistence/db.ts`
  - Update `getServerMessages(projectId, onProgress?)` to:
    - fetch only the most recent page on initial open (e.g., `order=desc`, `limit=PAGE_SIZE`, `offset=0`)
    - return `{ messages, total }` to the caller (include `total` so UI knows if more pages exist)
  - Add `getServerMessagesPage(projectId, { order, limit, offset })` to support “load older”.
- Update `app/lib/persistence/useChatHistory.ts`
  - Keep the existing “server first, local fallback” flow, but:
    - initialize chat with the recent server page (reversed to chronological display)
    - compute `hasOlder` using `total > loadedCount`
    - expose `loadOlderMessages()` callback in the hook return value
  - Ensure merge with local-only messages remains deterministic by `message_id`.
- Update `app/components/chat/Messages.client.tsx` (or `Chat.client.tsx`)
  - Add a “Load older messages” control above the message list when `hasOlder` is true.
  - On click:
    - fetch next page (increase `offset`)
    - reverse that page and prepend to current messages
    - disable button while loading; surface errors via toast

### Client: pending sync state + background sync

**Goal**: If server sync is unavailable (signed out or fetch fails), keep messages locally and clearly show “not yet synced”.

- Add `app/lib/persistence/messageSyncState.ts` (new)
  - Functions to:
    - mark a message id pending for a project
    - clear pending on successful server confirmation
    - compute overall sync banner state for a project (synced/syncing/pending/error/signed-out)
  - Backing store:
    - minimal-change approach: store pending markers in message `annotations` plus a small per-project “pending ids” list (implementation detail selected during tasks).
- Update `storeMessageHistory()` in `app/lib/persistence/useChatHistory.ts`
  - When `projectId` is missing (signed out or not resolved), always mark new messages as pending.
  - When `projectId` exists but server write fails:
    - mark new messages pending
    - keep working with local state
- Add a background sync effect (in `useChatHistory.ts` or higher-level chat store)
  - When `projectId` exists and user becomes authenticated:
    - send pending messages via the new append-only endpoint
    - clear pending markers on success
    - expose a manual “Retry sync” action if background retries fail

### Server: append-only message insertion (no overwrites)

**Goal**: Prevent data loss from concurrent sessions and avoid expensive full-history writes.

- Keep the existing bulk route `POST /api/projects/:id/messages` for legacy/full-sync.
- Add a new route: `POST /api/projects/:id/messages/append`
  - Input: list of messages without `sequence_num`
  - Behavior:
    - validate via Zod
    - authenticate via Better Auth session
    - insert only new messages (dedupe by `message_id`)
    - allocate `sequence_num` on the server so concurrent sessions can’t collide

### Database: add `append_project_messages` function (migration)

Create a new Supabase migration that defines an RPC function:

- Name: `append_project_messages(p_project_id uuid, p_messages jsonb)`
- Uses advisory lock to serialize allocation:
  - `SELECT pg_advisory_xact_lock(hashtext(p_project_id::text));`
- Allocates `sequence_num` from `max(sequence_num)` and inserts with:
  - `ON CONFLICT (project_id, message_id) DO NOTHING`

This keeps existing unique constraints intact while preventing sequence collisions and overwrites.

### Clear chat history

- Server:
  - Add `DELETE /api/projects/:id/messages` to delete messages for project (authenticated + scoped).
- Client:
  - Add a “Clear chat history” UI action with confirmation.
  - On success, clear local IndexedDB chat for that project id/urlId and reset UI state.

## Rollout / Migration strategy

- Keep existing endpoints working.
- Introduce append endpoint and shift client to prefer it for new messages.
- Keep bulk `POST /messages` only for initial migrations or repair tooling (optional).

## Observability

- Log server operations with `createScopedLogger` (append, delete, list).
- Client logs + toast notifications for user-visible sync failures.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
