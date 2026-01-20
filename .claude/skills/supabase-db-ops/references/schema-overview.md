# Database Schema Overview

## Tables Summary

| Table | Purpose | RLS | Key Fields |
|-------|---------|-----|------------|
| `user` | Better Auth users | ✓ | id, email, name |
| `session` | Auth sessions | ✓ | id, user_id, token |
| `tenants` | Multi-tenancy | ✓ | id, name, domain |
| `profiles` | User profiles | ✓ | id, user_id, tenant_id |
| `projects` | User projects | ✓ | id, user_id, name, status |
| `project_messages` | Chat history | ✓ | id, project_id, content |
| `project_snapshots` | File snapshots | ✓ | id, project_id, files |
| `crawled_data` | Places API cache | ✓ | id, place_id, data |
| `business_profiles` | Restaurant info | ✓ | id, place_id, profile |
| `deployments` | Deploy history | ✓ | id, project_id, url |
| `info_collection_sessions` | Form sessions | ✓ | id, session_data |

## Entity Relationship Diagram

```
┌────────────┐       ┌────────────┐       ┌────────────────┐
│   user     │───────│  profiles  │───────│    tenants     │
│            │ 1   * │            │ *   1 │                │
└────────────┘       └────────────┘       └────────────────┘
      │
      │ 1
      │
      │ *
┌────────────┐
│  projects  │
│            │
└────────────┘
      │
      │ 1
      │
      ├──────────────────┬────────────────────┐
      │ *                │ 1                  │ *
┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐
│project_messages │  │ project_snapshots│  │  deployments   │
│                 │  │                  │  │                │
└─────────────────┘  └──────────────────┘  └────────────────┘
```

## Core Tables Detail

### users (Better Auth)

```sql
CREATE TABLE "user" (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'published', 'archived')),
  url_id TEXT UNIQUE,                    -- Public URL slug
  business_profile JSONB,                -- Restaurant data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_url_id ON projects(url_id);
CREATE INDEX idx_projects_user_status_updated 
  ON projects(user_id, status, updated_at DESC);
```

### project_messages

```sql
CREATE TABLE project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,              -- Client-generated ID
  sequence_num INTEGER NOT NULL,         -- Ordering
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,                -- Message content
  annotations JSONB,                     -- Tool calls, usage, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, sequence_num),
  UNIQUE(project_id, message_id)
);

-- Indexes
CREATE INDEX idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX idx_project_messages_sequence 
  ON project_messages(project_id, sequence_num);
```

### project_snapshots

```sql
CREATE TABLE project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  files JSONB NOT NULL,                  -- { "path": "content", ... }
  summary TEXT,                          -- Auto-generated summary
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id)                     -- One snapshot per project
);
```

### crawled_data (Places API cache)

```sql
CREATE TABLE crawled_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,                   -- Full Places API response
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_crawled_data_place_id ON crawled_data(place_id);
CREATE INDEX idx_crawled_data_expires_at ON crawled_data(expires_at);
```

### deployments

```sql
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'netlify', 'vercel', 'github', 'gitlab', 'amplify', 'cloudflare'
  )),
  url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'building', 'deploying', 'complete', 'failed'
  )),
  build_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## RLS Policy Pattern

All user-facing tables use this RLS pattern:

```sql
-- Enable RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Policy for all operations
CREATE POLICY "user_access" ON my_table
  FOR ALL USING (
    -- User can access their own rows
    current_setting('app.current_user_id', true)::uuid = user_id
    OR
    -- Service role bypasses RLS
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

For related tables (messages, snapshots), check parent:

```sql
CREATE POLICY "user_access" ON project_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (
        current_setting('app.current_user_id', true)::uuid = projects.user_id
        OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
      )
    )
  );
```

## Common Queries

### Get user's projects with latest activity

```sql
SELECT p.*, 
  (SELECT MAX(created_at) FROM project_messages WHERE project_id = p.id) as last_message_at
FROM projects p
WHERE p.user_id = $1
ORDER BY COALESCE(last_message_at, p.updated_at) DESC
LIMIT 20;
```

### Get project with messages and snapshot

```sql
SELECT 
  p.*,
  (
    SELECT jsonb_agg(m ORDER BY m.sequence_num)
    FROM project_messages m
    WHERE m.project_id = p.id
  ) as messages,
  (
    SELECT row_to_json(s)
    FROM project_snapshots s
    WHERE s.project_id = p.id
  ) as snapshot
FROM projects p
WHERE p.id = $1;
```

### Upsert snapshot

```sql
INSERT INTO project_snapshots (project_id, files, summary)
VALUES ($1, $2, $3)
ON CONFLICT (project_id) 
DO UPDATE SET 
  files = EXCLUDED.files,
  summary = EXCLUDED.summary,
  updated_at = NOW()
RETURNING *;
```

### Append messages (batch)

```sql
INSERT INTO project_messages (project_id, message_id, sequence_num, role, content, annotations)
SELECT 
  $1,
  (value->>'id')::text,
  (value->>'sequence_num')::integer,
  (value->>'role')::text,
  (value->'content')::jsonb,
  (value->'annotations')::jsonb
FROM jsonb_array_elements($2::jsonb)
ON CONFLICT (project_id, message_id) DO NOTHING
RETURNING *;
```

## Migration Files

| Migration | Description |
|-----------|-------------|
| `20251122233138_phase1_core.sql` | Core tenants/profiles |
| `20251123000000_places_crawler_schema.sql` | Crawled data tables |
| `20251125000000_better_auth_schema.sql` | Auth tables |
| `20251208000000_deployments.sql` | Deployment tracking |
| `20251209000000_info_collection_sessions.sql` | Form sessions |
| `20251217000000_projects_schema.sql` | Projects/messages/snapshots |
| `20251221000000_fix_auth_rls.sql` | RLS policy fixes |
| `20251222000000_set_current_user_context.sql` | RLS context function |
| `20251230000000_append_project_messages.sql` | Batch append function |
| `20260104120000_add_projects_business_profile.sql` | Business profile JSONB |
