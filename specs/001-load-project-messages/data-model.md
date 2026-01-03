# Data Model: Load Project Messages on Open

**Feature**: 001-load-project-messages  
**Date**: 2025-12-27

## Overview

This feature works with existing data models. No new database tables required. This document defines the **client-side types** for loading state management and message handling.

---

## Existing Entities (No Changes)

### ProjectMessage (Server - Supabase)

Already defined in `app/types/project.ts`:

```typescript
interface ProjectMessage {
  id: string;              // Database UUID
  project_id: string;      // Foreign key to projects table
  message_id: string;      // Client-generated UUID (unique identifier)
  sequence_num: number;    // Display order
  role: 'user' | 'assistant' | 'system';
  content: unknown;        // JSON content (Vercel AI SDK format)
  annotations: JSONValue[] | null;
  created_at: string;      // ISO timestamp
}
```

### Message (Client - AI SDK)

From `ai` package:

```typescript
interface Message {
  id: string;              // Maps to message_id
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: Date;
  annotations?: JSONValue[];
  // ... other AI SDK fields
}
```

### ChatHistoryItem (Client - IndexedDB)

Already defined in `app/lib/persistence/useChatHistory.ts`:

```typescript
interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}
```

---

## New Types (Client-Side Only)

### MessageLoadingState

State machine for tracking message loading progress:

```typescript
// File: app/types/message-loading.ts

export type LoadingPhase =
  | 'idle'           // Not loading
  | 'server'         // Fetching from server
  | 'partial'        // Some messages loaded, more coming
  | 'local'          // Falling back to IndexedDB
  | 'merging'        // Merging server + local
  | 'complete'       // All messages loaded
  | 'error';         // Failed to load

export interface MessageLoadingState {
  phase: LoadingPhase;
  loaded: number;           // Messages loaded so far
  total: number | null;     // Total messages (null if unknown)
  error: string | null;     // Error message if phase === 'error'
  isPartial: boolean;       // True if some messages couldn't be loaded
  retryCount: number;       // Current retry attempt
  lastRetryAt: Date | null; // Timestamp of last retry
}

export const initialLoadingState: MessageLoadingState = {
  phase: 'idle',
  loaded: 0,
  total: null,
  error: null,
  isPartial: false,
  retryCount: 0,
  lastRetryAt: null,
};
```

### MessageLoadProgress

Progress callback payload:

```typescript
export interface MessageLoadProgress {
  loaded: number;
  total: number;
  page: number;
  isComplete: boolean;
  isRateLimited: boolean;
}

export type OnProgressCallback = (progress: MessageLoadProgress) => void;
```

### MessageLoaderOptions

Configuration for paginated loader:

```typescript
export interface MessageLoaderOptions {
  pageSize: number;              // Messages per page (default: 100)
  maxRetries: number;            // Max retry attempts (default: 3)
  baseDelay: number;             // Initial backoff delay ms (default: 1000)
  maxDelay: number;              // Max backoff delay ms (default: 30000)
  onProgress?: OnProgressCallback;
}

export const defaultLoaderOptions: MessageLoaderOptions = {
  pageSize: 100,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};
```

### MessageLoadResult

Return type from message loader:

```typescript
export interface MessageLoadResult {
  messages: Message[];
  total: number;
  source: 'server' | 'local' | 'merged';
  isPartial: boolean;           // True if rate limited before complete
  loadedFromServer: number;     // Count from server
  loadedFromLocal: number;      // Count from local (if merged)
}
```

### MergeResult

Return type from message merge:

```typescript
export interface MergeResult {
  messages: Message[];
  serverCount: number;
  localOnlyCount: number;
  duplicatesRemoved: number;
}
```

---

## State Transitions

```
┌──────────┐
│   idle   │
└────┬─────┘
     │ projectId && authenticated
     ▼
┌──────────┐     network error     ┌──────────┐
│  server  │─────────────────────▶│  local   │
└────┬─────┘                       └────┬─────┘
     │ first page received              │
     ▼                                  │
┌──────────┐                            │
│ partial  │◀───────────────────────────┘
└────┬─────┘     has local messages     
     │ all pages fetched / rate limited
     ▼
┌──────────┐
│ merging  │
└────┬─────┘
     │ merge complete
     ▼
┌──────────┐
│ complete │
└──────────┘

Any state → error (on unrecoverable failure)
```

---

## Validation Rules

### Message Uniqueness

- `message_id` (UUID) is the canonical unique identifier
- When merging, deduplicate by `message_id`
- Server messages always win on conflict

### Ordering

1. Primary sort: `sequence_num` ascending
2. Secondary sort: `created_at` ascending (for ties)
3. Local-only messages get `sequence_num = max(server_seq) + 1 + index`

### Content Validation

Messages with invalid content are skipped:

```typescript
function isValidMessage(msg: unknown): msg is Message {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'id' in msg &&
    typeof (msg as any).id === 'string' &&
    'role' in msg &&
    ['user', 'assistant', 'system'].includes((msg as any).role) &&
    'content' in msg
  );
}
```

---

## Relationships

```
┌─────────────┐       ┌───────────────────┐
│   Project   │───────│  ProjectMessage   │
│             │  1:N  │                   │
│  id (PK)    │       │  project_id (FK)  │
│  url_id     │       │  message_id (UK)  │
│  user_id    │       │  sequence_num     │
└─────────────┘       └───────────────────┘
                               │
                               │ transforms to
                               ▼
                      ┌───────────────────┐
                      │     Message       │
                      │   (AI SDK)        │
                      │                   │
                      │  id = message_id  │
                      │  role             │
                      │  content          │
                      └───────────────────┘
```

---

## Migration Notes

No database migrations required. All new types are client-side only.

The existing `project_messages` table schema is sufficient:

```sql
-- Already exists (from 001-user-project-tables)
CREATE TABLE project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id VARCHAR(255) NOT NULL,
  sequence_num INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL,
  content JSONB NOT NULL,
  annotations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, sequence_num),
  UNIQUE(project_id, message_id)
);

CREATE INDEX idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX idx_project_messages_sequence ON project_messages(project_id, sequence_num);
```

