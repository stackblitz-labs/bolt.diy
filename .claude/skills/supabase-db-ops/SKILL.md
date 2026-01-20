---
name: supabase-db-ops
description: Use when working with Supabase/PostgreSQL database operations - projects, messages, snapshots tables, migrations, RLS policies, server-side client setup, and API routes. Triggers include "Supabase", "PostgreSQL", "database", "RLS", "migration", "projects table", "project_messages", "project_snapshots", "api.supabase", "createUserSupabaseClient", "service key".
---

# Supabase Database Operations Skill

## Goal

Work with the Supabase/PostgreSQL database following established patterns for migrations, RLS policies, server-side client usage, and API routes.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Routes                                    │
│  app/routes/api.supabase*.ts    app/routes/api.projects*.ts         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Service Layer                                    │
│  app/lib/services/projects.server.ts                                │
│  app/lib/services/infoCollectionService.server.ts                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Supabase Client Layer                              │
│  app/lib/db/supabase.server.ts                                      │
│  ├── createSupabaseClient()      # Admin client                     │
│  ├── createUserSupabaseClient()  # User context for RLS             │
│  └── getSupabaseAdmin()          # Singleton admin                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Supabase/PostgreSQL                                │
│  supabase/migrations/*.sql                                          │
│  ├── projects              # User projects                          │
│  ├── project_messages      # Chat messages per project              │
│  ├── project_snapshots     # File snapshots per project             │
│  └── ...other tables                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
supabase/
├── migrations/                     # SQL migrations (timestamped)
│   ├── 20251122233138_phase1_core.sql
│   ├── 20251217000000_projects_schema.sql
│   └── ...
└── .branches/                      # Local branch data

app/lib/
├── db/
│   ├── supabase.server.ts         # Supabase client factory
│   └── drizzle.server.ts          # Drizzle ORM setup
├── services/
│   └── projects.server.ts         # Project CRUD service
└── errors/
    └── supabase-error.ts          # RLS error handling
```

## Supabase Client Setup

### Environment Variables

```bash
# Required for server-side operations
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Optional: can use VITE_ prefix for shared config
VITE_SUPABASE_URL=https://your-project.supabase.co
```

### Client Types

```typescript
// app/lib/db/supabase.server.ts

// Admin client - bypasses RLS (use for service operations)
import { createSupabaseClient, getSupabaseAdmin } from '~/lib/db/supabase.server';

const admin = createSupabaseClient();
// or singleton:
const admin = getSupabaseAdmin();

// User context client - respects RLS policies
import { createUserSupabaseClient } from '~/lib/db/supabase.server';

const client = await createUserSupabaseClient(userId);
// Sets app.current_user_id for RLS via set_current_user RPC
```

### RLS User Context Pattern

```typescript
import { createUserSupabaseClient } from '~/lib/db/supabase.server';
import { SupabaseRlsError } from '~/lib/errors/supabase-error';

async function getUserProjects(userId: string) {
  try {
    // Create client with user context for RLS
    const supabase = await createUserSupabaseClient(userId);
    
    // Query will only return rows allowed by RLS policies
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data;
  } catch (error) {
    if (error instanceof SupabaseRlsError) {
      // Handle RLS-specific errors
      console.error('RLS error:', error.code, error.message);
    }
    throw error;
  }
}
```

## Core Tables Schema

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
  url_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### project_messages

```sql
CREATE TABLE project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sequence_num INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  annotations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id, sequence_num),
  UNIQUE(project_id, message_id)
);
```

### project_snapshots

```sql
CREATE TABLE project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  files JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(project_id)  -- One snapshot per project
);
```

## Row Level Security (RLS)

### RLS Pattern Used

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- User can only access their own rows
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

### Setting User Context

The `createUserSupabaseClient()` function calls the `set_current_user` RPC:

```sql
-- RPC function to set user context atomically
CREATE OR REPLACE FUNCTION set_current_user(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, false);
  RETURN user_id::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Writing Migrations

### Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20251217000000_projects_schema.sql`

### Migration Template

```sql
-- Migration: Feature Name
-- Description: What this migration does
-- Feature: feature-id (links to spec)

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_my_table_user_id ON my_table(user_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at
CREATE TRIGGER update_my_table_updated_at 
  BEFORE UPDATE ON my_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view own records" ON my_table
  FOR SELECT USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- INSERT policy
CREATE POLICY "Users can insert own records" ON my_table
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- UPDATE policy
CREATE POLICY "Users can update own records" ON my_table
  FOR UPDATE USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- DELETE policy
CREATE POLICY "Users can delete own records" ON my_table
  FOR DELETE USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );
```

## API Routes Pattern

### Basic Supabase API Route

```typescript
// app/routes/api.my-data.ts
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { z } from 'zod';
import { withSecurity } from '~/lib/security';
import { createUserSupabaseClient } from '~/lib/db/supabase.server';

const RequestSchema = z.object({
  userId: z.string().uuid(),
});

export const action = withSecurity(
  async ({ request }: ActionFunctionArgs) => {
    const body = await request.json();
    const { userId } = RequestSchema.parse(body);
    
    try {
      const supabase = await createUserSupabaseClient(userId);
      
      const { data, error } = await supabase
        .from('my_table')
        .select('*');
      
      if (error) {
        return json({ error: error.message }, { status: 500 });
      }
      
      return json({ data });
    } catch (error) {
      return json({ error: 'Database operation failed' }, { status: 500 });
    }
  },
  { allowedMethods: ['POST'] }
);
```

### Query Execution Route (Reference)

```typescript
// app/routes/api.supabase.query.ts
export async function action({ request }: ActionFunctionArgs) {
  const authHeader = request.headers.get('Authorization');
  const { projectId, query } = await request.json();
  
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  
  return new Response(JSON.stringify(await response.json()), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Common Operations

### CRUD Examples

```typescript
// Create
const { data, error } = await supabase
  .from('projects')
  .insert({ name: 'New Project', user_id: userId })
  .select()
  .single();

// Read (list)
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10);

// Read (single with relations)
const { data, error } = await supabase
  .from('projects')
  .select(`
    *,
    project_messages (
      id, content, role, sequence_num
    ),
    project_snapshots (
      id, files, summary
    )
  `)
  .eq('id', projectId)
  .single();

// Update
const { data, error } = await supabase
  .from('projects')
  .update({ name: 'Updated Name' })
  .eq('id', projectId)
  .select()
  .single();

// Delete
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId);

// Upsert
const { data, error } = await supabase
  .from('project_snapshots')
  .upsert(
    { project_id: projectId, files: filesJson },
    { onConflict: 'project_id' }
  )
  .select()
  .single();
```

### JSONB Operations

```typescript
// Query JSONB field
const { data } = await supabase
  .from('project_messages')
  .select('*')
  .contains('content', { type: 'text' });

// Update JSONB field
const { data } = await supabase
  .from('projects')
  .update({ 
    business_profile: { name: 'Restaurant', type: 'restaurant' } 
  })
  .eq('id', projectId);
```

## Error Handling

### SupabaseRlsError

```typescript
import { SupabaseRlsError } from '~/lib/errors/supabase-error';

try {
  const client = await createUserSupabaseClient(userId);
  // ... operations
} catch (error) {
  if (error instanceof SupabaseRlsError) {
    switch (error.code) {
      case 'CONTEXT_SET_FAILED':
        // Failed to set RLS context
        break;
      case 'CONTEXT_NOT_SET':
        // RLS context was not set
        break;
      case 'INVALID_USER_ID':
        // Invalid user ID provided
        break;
      case 'CONTEXT_VERIFICATION_FAILED':
        // Context mismatch (connection pooling issue)
        break;
    }
  }
}
```

## Checklist

- [ ] Migration file named with timestamp: `YYYYMMDDHHMMSS_description.sql`
- [ ] Tables have proper foreign keys with ON DELETE
- [ ] Indexes created for frequently queried columns
- [ ] RLS enabled and policies defined for all operations
- [ ] Policies use `current_setting('app.current_user_id', true)::uuid`
- [ ] Service role bypass included in policies
- [ ] `updated_at` trigger added for update tracking
- [ ] Server-side operations use `.server.ts` suffix
- [ ] User operations use `createUserSupabaseClient(userId)`
- [ ] Admin operations use `createSupabaseClient()` or `getSupabaseAdmin()`
- [ ] Errors handled with proper error types
- [ ] Zod schemas validate request bodies
- [ ] No secrets/keys logged or returned in responses

## References

- `app/lib/db/supabase.server.ts` - Client factory
- `app/lib/errors/supabase-error.ts` - RLS error types
- `app/lib/services/projects.server.ts` - Service layer example
- `supabase/migrations/20251217000000_projects_schema.sql` - Schema reference
- `app/routes/api.supabase.query.ts` - Query route example
- `references/schema-overview.md` - Database schema summary
