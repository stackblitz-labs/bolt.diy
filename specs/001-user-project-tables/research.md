# Research: User Project Tables

**Feature**: 001-user-project-tables  
**Date**: 2025-12-17

## Design Decisions

### 1. Storage Pattern: StackBlitz Snapshot vs Per-File Storage

**Decision**: StackBlitz-style JSONB snapshot (entire FileMap as single blob)

**Rationale**: 
- Mirrors existing IndexedDB `snapshots` object store structure exactly
- Minimal code changes to frontend persistence layer
- Single read/write operation for restore/save
- Already proven pattern in current codebase

**Alternatives Considered**:

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| Per-file table rows | Incremental saves, query single files | Major refactor, more complex migrations | Too many changes for MVP |
| R2 object storage | Unlimited size, cheaper | Higher latency, external dependency | Adds complexity, not needed for typical project sizes |
| Hybrid (DB + R2) | Best of both | Complex logic, two storage systems | Over-engineered for current needs |

**References**:
- Current implementation: `app/lib/persistence/db.ts` - `setSnapshot()`, `getSnapshot()`
- Type definition: `app/lib/persistence/types.ts` - `Snapshot` interface

---

### 2. Message Storage: JSONB Array vs Separate Table

**Decision**: Separate `project_messages` table with one row per message

**Rationale**:
- Enables pagination for large chat histories (500+ messages)
- Allows querying individual messages (for search, analytics)
- Better indexing options (by timestamp, role)
- Follows normalized database design
- Matches existing `deployments` table pattern

**Alternatives Considered**:

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|--------------|
| JSONB array in project | Single query for all messages | No pagination, array updates expensive | Won't scale beyond 100 messages |
| Separate chat entity | Supports multiple chats per project | Over-complex for single-chat model | YAGNI - one chat per project sufficient |

**Schema Pattern**:
```sql
-- Separate table enables efficient queries
SELECT * FROM project_messages 
WHERE project_id = $1 
ORDER BY sequence_num 
LIMIT 50 OFFSET 100;
```

---

### 3. Project-Tenant Integration

**Decision**: Projects link to existing `tenants` table, business data in `business_profiles`

**Rationale**:
- Reuses existing address, gmaps_url, contact_info fields
- No data duplication
- Existing RLS policies can be extended
- Consistent with multi-tenant architecture

**Entity Relationships**:
```
user (1) ──── owns ────> (N) projects
project (1) ──── links ────> (1) tenant
tenant (1) ──── has ────> (1) business_profile
```

**Implementation**:
- `projects.tenant_id` FK to `tenants.id`
- Create tenant automatically when creating first project
- Or link to existing tenant if user has one

---

### 4. Row-Level Security Strategy

**Decision**: User-based RLS using `app.current_user_id` session variable

**Rationale**:
- Matches existing Better Auth session pattern
- Consistent with `user` table RLS policies
- Service role bypass for admin operations

**Policy Pattern**:
```sql
-- Users can only access their own projects
CREATE POLICY project_user_access ON projects
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);
```

---

### 5. Soft Limit Enforcement (10 Projects)

**Decision**: Application-level check, not database constraint

**Rationale**:
- Allows flexibility to increase limit per user
- Can show helpful error message in UI
- Database constraint would require migration to change

**Implementation**:
```typescript
// In projects.server.ts
async function canCreateProject(userId: string): Promise<boolean> {
  const count = await getProjectCount(userId);
  const limit = await getUserProjectLimit(userId); // Default 10
  return count < limit;
}
```

---

### 6. Snapshot Size Management

**Decision**: ~50MB soft limit with database constraint

**Rationale**:
- Typical website project: 50-100 files, <5MB total
- PostgreSQL JSONB performant up to ~100MB
- Constraint prevents accidental huge blobs
- Matches existing `crawled_data` size limit pattern

**Implementation**:
```sql
CONSTRAINT snapshot_size_limit CHECK (
  pg_column_size(files) <= 52428800  -- ~50MB
)
```

---

### 7. API Design: REST vs GraphQL

**Decision**: REST API with Remix action/loader pattern

**Rationale**:
- Consistent with existing API routes (`api.deploy-status.ts`, etc.)
- Simpler implementation, no additional dependencies
- Works well with Remix data loading patterns

**Endpoint Structure**:
```
GET    /api/projects           - List user's projects
POST   /api/projects           - Create project
GET    /api/projects/:id       - Get project details
PATCH  /api/projects/:id       - Update project
DELETE /api/projects/:id       - Delete project
GET    /api/projects/:id/messages  - Get chat messages
POST   /api/projects/:id/messages  - Save messages
GET    /api/projects/:id/snapshot  - Get file snapshot
PUT    /api/projects/:id/snapshot  - Save snapshot
```

---

## Technology Choices

### Database Client

**Decision**: Use existing Supabase JS client

**Location**: `app/lib/db/index.ts` (if exists) or create new

**Pattern**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);
```

### Authentication Context

**Decision**: Pass user ID from Better Auth session to database context

**Pattern**:
```typescript
// In API route
const session = await auth.api.getSession({ headers: request.headers });
if (!session?.user) throw new Response('Unauthorized', { status: 401 });

// Set context for RLS
await supabase.rpc('set_current_user', { user_id: session.user.id });
```

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Version history needed? | No - current state only (per clarification) |
| Migration from IndexedDB? | No - dev phase, local data can be discarded |
| Max projects per user? | 10 soft limit (configurable) |
| File storage location? | JSONB in database (StackBlitz pattern) |

---

## References

- Existing schema: `supabase/migrations/20251122233138_phase1_core.sql`
- Better Auth schema: `supabase/migrations/20251125000000_better_auth_schema.sql`
- IndexedDB implementation: `app/lib/persistence/db.ts`
- Snapshot types: `app/lib/persistence/types.ts`

