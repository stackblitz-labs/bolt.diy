# Data Model: User Project Tables

**Feature**: 001-user-project-tables  
**Date**: 2025-12-17

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────────┐       ┌───────────────────┐
│    user     │       │    projects     │       │ project_messages  │
├─────────────┤       ├─────────────────┤       ├───────────────────┤
│ id (PK)     │──┐    │ id (PK)         │──┐    │ id (PK)           │
│ name        │  │    │ user_id (FK)────│──┘    │ project_id (FK)───│──┐
│ email       │  │    │ tenant_id (FK)  │       │ sequence_num      │  │
│ tenant_id   │  └───>│ name            │       │ role              │  │
│ ...         │       │ status          │       │ content           │  │
└─────────────┘       │ created_at      │       │ annotations       │  │
                      │ updated_at      │       │ created_at        │  │
                      └─────────────────┘       └───────────────────┘  │
                             │                                         │
                             │                  ┌───────────────────┐  │
                             │                  │ project_snapshots │  │
                             │                  ├───────────────────┤  │
                             └─────────────────>│ id (PK)           │  │
                                                │ project_id (FK)───│──┘
                                                │ files (JSONB)     │
                                                │ summary           │
                                                │ created_at        │
                                                │ updated_at        │
                                                └───────────────────┘
```

## Tables

### projects

Central table representing user website projects.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| `user_id` | UUID | FK → user(id), NOT NULL, ON DELETE CASCADE | Owner of the project |
| `tenant_id` | UUID | FK → tenants(id), ON DELETE SET NULL | Link to tenant for business data |
| `name` | VARCHAR(255) | NOT NULL | Project display name |
| `description` | TEXT | | Optional project description |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'draft', CHECK | Project lifecycle state |
| `url_id` | VARCHAR(255) | UNIQUE | URL-friendly identifier (for /chat/:urlId routes) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp |

**Status Values**: `draft`, `published`, `archived`

**Indexes**:
- `idx_projects_user_id` on `user_id`
- `idx_projects_tenant_id` on `tenant_id` WHERE tenant_id IS NOT NULL
- `idx_projects_status` on `status`
- `idx_projects_url_id` on `url_id` WHERE url_id IS NOT NULL

---

### project_messages

Stores chat messages for each project. Mirrors IndexedDB `chats.messages` structure.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique message identifier |
| `project_id` | UUID | FK → projects(id), NOT NULL, ON DELETE CASCADE | Parent project |
| `message_id` | VARCHAR(255) | NOT NULL | Original AI SDK message ID |
| `sequence_num` | INTEGER | NOT NULL | Order within conversation |
| `role` | VARCHAR(20) | NOT NULL, CHECK | Message author role |
| `content` | TEXT | NOT NULL | Message content (text or JSON string) |
| `annotations` | JSONB | DEFAULT '[]' | AI SDK annotations |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Message timestamp |

**Role Values**: `user`, `assistant`, `system`

**Indexes**:
- `idx_project_messages_project_id` on `project_id`
- `idx_project_messages_sequence` on `(project_id, sequence_num)`
- `idx_project_messages_created_at` on `created_at`

**Constraints**:
- `UNIQUE(project_id, sequence_num)` - Ensures message ordering

---

### project_snapshots

Stores file system snapshots. Mirrors IndexedDB `snapshots` structure.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique identifier |
| `project_id` | UUID | FK → projects(id), NOT NULL, UNIQUE, ON DELETE CASCADE | One snapshot per project |
| `files` | JSONB | NOT NULL, DEFAULT '{}' | FileMap structure with all files |
| `summary` | TEXT | | Chat summary for context |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_project_snapshots_project_id` on `project_id` (UNIQUE)
- `idx_project_snapshots_updated_at` on `updated_at`

**Constraints**:
- `snapshot_size_limit`: `pg_column_size(files) <= 52428800` (~50MB)

---

## JSONB Structures

### files (in project_snapshots)

Mirrors `FileMap` type from `app/lib/stores/files.ts`:

```typescript
interface FileMap {
  [filePath: string]: {
    type: 'file' | 'folder';
    content?: string;      // For files
    isBinary?: boolean;    // True for binary files (base64 encoded)
  } | undefined;
}
```

**Example**:
```json
{
  "/home/project/src/App.tsx": {
    "type": "file",
    "content": "export default function App() { ... }",
    "isBinary": false
  },
  "/home/project/src": {
    "type": "folder"
  },
  "/home/project/public/logo.png": {
    "type": "file",
    "content": "iVBORw0KGgoAAAANSUhEUgAA...",
    "isBinary": true
  }
}
```

### annotations (in project_messages)

Mirrors AI SDK annotation format:

```json
[
  { "type": "chatSummary", "summary": "User requested dark mode theme" },
  { "type": "context", "files": ["src/App.tsx"] }
]
```

---

## Row-Level Security Policies

### projects table

```sql
-- Users can only access their own projects
CREATE POLICY projects_user_access ON projects
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Service role bypass
CREATE POLICY projects_service_role ON projects
  FOR ALL
  USING (current_setting('role', TRUE) = 'service_role');
```

### project_messages table

```sql
-- Access via project ownership
CREATE POLICY project_messages_user_access ON project_messages
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    )
  );
```

### project_snapshots table

```sql
-- Access via project ownership
CREATE POLICY project_snapshots_user_access ON project_snapshots
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects 
      WHERE user_id = current_setting('app.current_user_id', TRUE)::UUID
    )
  );
```

---

## Migration SQL

Full migration available at: `supabase/migrations/20251217000000_projects_schema.sql`

```sql
-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'published', 'archived')),
  url_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROJECT_MESSAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  sequence_num INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  annotations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, sequence_num)
);

-- ============================================================================
-- PROJECT_SNAPSHOTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  files JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT snapshot_size_limit CHECK (pg_column_size(files) <= 52428800)
);
```

---

## TypeScript Types

```typescript
// app/types/project.ts

export type ProjectStatus = 'draft' | 'published' | 'archived';

export interface Project {
  id: string;
  user_id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  url_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  message_id: string;
  sequence_num: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  annotations: unknown[];
  created_at: string;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  files: FileMap;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

// Re-export existing FileMap type
export type { FileMap } from '~/lib/stores/files';
```

