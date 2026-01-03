# Data Model: Project Chat Sync

**Date**: 2025-12-30  
**Branch**: `001-project-chat-sync`  
**Spec**: [`spec.md`](./spec.md)  
**Research**: [`research.md`](./research.md)

## Server-side (Supabase/PostgreSQL)

### Table: `projects`

Source: `supabase/migrations/20251217000000_projects_schema.sql`

- **id**: UUID (PK)
- **user_id**: UUID (FK to `user.id`, owner)
- **name**: text
- **description**: text (nullable)
- **status**: text enum (`draft` | `published` | `archived`)
- **url_id**: text (unique, nullable)
- **created_at**, **updated_at**: timestamptz

### Table: `project_messages`

Source: `supabase/migrations/20251217000000_projects_schema.sql`

- **id**: UUID (PK)
- **project_id**: UUID (FK to `projects.id`)
- **message_id**: text (unique per project) — **canonical identifier**
- **sequence_num**: integer (unique per project) — ordering index
- **role**: text enum (`user` | `assistant` | `system`)
- **content**: JSONB (AI SDK message content)
- **annotations**: JSONB (nullable)
- **created_at**: timestamptz

**Existing uniqueness rules**

- `UNIQUE(project_id, message_id)`
- `UNIQUE(project_id, sequence_num)`

**Existing access control**

- RLS policies restrict reads/writes to the project owner.

### Table: `project_snapshots`

Source: `supabase/migrations/20251217000000_projects_schema.sql`

- **id**: UUID (PK)
- **project_id**: UUID (FK to `projects.id`, unique)
- **files**: JSONB
- **summary**: text (nullable)
- **created_at**, **updated_at**: timestamptz

## Client-side (IndexedDB)

### Database: `boltHistory` (v2)

Source: `app/lib/persistence/db.ts`

#### Object store: `chats` (keyPath: `id`)

Stored shape (conceptual):

- **id**: string (chat id / urlId)
- **urlId**: string (unique)
- **description**: string (nullable)
- **timestamp**: ISO string
- **messages**: AI SDK messages array
- **metadata**: chat metadata (git url, deploy ids, etc.)

#### Object store: `snapshots` (keyPath: `chatId`)

- **chatId**: string
- **snapshot**: `{ chatIndex, files, summary, created_at?, updated_at? }`

### New local state required by this feature

We need durable local tracking of “pending sync” messages to satisfy:

- Signed-out messaging is allowed
- Sync failures must not lose messages
- Messages must be clearly labeled “not yet synced”

**Proposed local sync state (conceptual)**

- **Pending message IDs per project**: set of `message_id` values
- **Last successful server sync marker** (optional): last synced message id/time

Storage options (implementation choice during tasks):

- Option A: Encode a small “pending” annotation into each pending message in the `chats.messages[]` payload.
- Option B: Add a new IndexedDB object store, e.g. `pending_message_ids` keyed by `projectId`.

## Server append-only write primitive (required for concurrency safety)

To guarantee “merge-only, no overwrites” across concurrent sessions, server writes for new messages must not upsert by `(project_id, sequence_num)`.

### Proposed database function: `append_project_messages`

**Purpose**: Insert new messages for a project, allocating `sequence_num` on the server under a per-project lock.

**Inputs**

- `p_project_id uuid`
- `p_messages jsonb` (array of message objects)

Each input message object contains:

- `message_id` (text)
- `role` (text)
- `content` (jsonb)
- `annotations` (jsonb, optional)
- `created_at` (timestamptz, optional)

**Behavior**

- Acquire `pg_advisory_xact_lock(hashtext(p_project_id::text))` to serialize sequence allocation per project.
- Read `max(sequence_num)` for the project.
- For each input message (in request order):
  - Insert with `sequence_num = max + 1 + i` when `message_id` does not already exist.
  - Use `ON CONFLICT (project_id, message_id) DO NOTHING` to avoid duplicates.
- Return `{ inserted_count }`.

**Note**: This keeps existing schema constraints intact while eliminating the “two sessions pick the same next sequence number” overwrite risk.

## Ordering & pagination rules (user-visible)

- **Canonical order for display**: `sequence_num` ascending (stable) with timestamp as secondary tie-breaker if ever needed.
- **Initial load on project open**: fetch newest messages first (`order=desc`) and reverse in UI for chronological display.
- **Load older**: fetch next page with increased offset (still `order=desc`), reverse that page, and prepend.

