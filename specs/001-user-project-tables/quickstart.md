# Quickstart: User Project Tables

**Feature**: 001-user-project-tables  
**Date**: 2025-12-17

## Prerequisites

- Node.js >=18.18.0
- pnpm package manager
- Supabase CLI installed (`brew install supabase/tap/supabase`)
- Local Supabase instance running OR Supabase cloud project

## Setup Steps

### 1. Apply Database Migration

```bash
# If using local Supabase
supabase db reset  # Applies all migrations

# If using Supabase cloud
supabase db push
```

The migration creates:
- `projects` table
- `project_messages` table
- `project_snapshots` table
- RLS policies for user isolation
- Necessary indexes

### 2. Verify Migration

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('projects', 'project_messages', 'project_snapshots');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('projects', 'project_messages', 'project_snapshots');
```

### 3. Environment Variables

Ensure these are set in `.env.local`:

```bash
# Already should exist from Better Auth setup
SUPABASE_URL=http://localhost:54321  # or your cloud URL
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 4. Test API Endpoints

Start the dev server:

```bash
pnpm run dev
```

Test project creation (requires authentication):

```bash
# Login first via the app UI, then use the session cookie

# List projects (should be empty)
curl -X GET http://localhost:5173/api/projects \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN"

# Create a project
curl -X POST http://localhost:5173/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=YOUR_SESSION_TOKEN" \
  -d '{"name": "My Restaurant Website"}'
```

## Development Workflow

### File Structure

```
app/
├── routes/
│   ├── api.projects.ts              # List/Create
│   ├── api.projects.$id.ts          # Get/Update/Delete
│   ├── api.projects.$id.messages.ts # Messages CRUD
│   └── api.projects.$id.snapshot.ts # Snapshot CRUD
├── lib/
│   ├── services/
│   │   └── projects.server.ts       # Business logic
│   └── persistence/
│       ├── db.server.ts             # Server-side DB operations
│       └── useProjects.ts           # React hook for projects
└── types/
    └── project.ts                   # TypeScript types
```

### Running Tests

```bash
# Unit tests
pnpm exec vitest run tests/unit/projects.test.ts

# Integration tests (requires running server)
pnpm exec vitest run tests/integration/projects.test.ts
```

### Common Development Tasks

#### Add a new project field

1. Update migration SQL (create new migration file)
2. Update `Project` type in `app/types/project.ts`
3. Update API schema in `contracts/projects-api.yaml`
4. Update service layer in `projects.server.ts`

#### Debug RLS issues

```sql
-- Temporarily disable RLS for debugging
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- Re-enable after debugging
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Check current user context
SELECT current_setting('app.current_user_id', TRUE);
```

## API Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/:id` | Get project details |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| GET | `/api/projects/:id/messages` | Get chat messages |
| POST | `/api/projects/:id/messages` | Save messages |
| GET | `/api/projects/:id/snapshot` | Get file snapshot |
| PUT | `/api/projects/:id/snapshot` | Save snapshot |

## Troubleshooting

### "Unauthorized" errors

- Ensure you're logged in via Better Auth
- Check session cookie is being sent
- Verify `SUPABASE_SERVICE_KEY` is set for service role operations

### "Project not found" for valid ID

- RLS policy may be blocking access
- Verify `app.current_user_id` is set correctly
- Check project belongs to the authenticated user

### Snapshot save fails with 413

- Snapshot exceeds ~50MB size limit
- Remove large binary files or move to external storage
- Check for duplicate/unnecessary files in FileMap

### Messages not loading

- Check pagination parameters (offset/limit)
- Verify messages were saved with correct `project_id`
- Check sequence_num ordering

## Next Steps

After basic setup:

1. **Implement frontend integration** - Update `useChatHistory` hook
2. **Add project selector UI** - Dashboard component
3. **Test cross-device sync** - Login from multiple browsers
4. **Add loading states** - Skeleton loaders for API calls

