# Implementation Tasks: User Project Tables

**Feature**: 001-user-project-tables  
**Branch**: `001-user-project-tables`  
**Generated**: 2025-12-17  
**Total Tasks**: 55

## Task Summary

| Phase | Description | Task Count | Parallelizable | Status |
|-------|-------------|------------|----------------|---------|
| Phase 1 | Setup & Infrastructure | 6 | 2 | ✅ COMPLETED |
| Phase 2 | Foundational (Database & Types) | 8 | 4 | ✅ COMPLETED |
| Phase 3 | US1 - Create New Project | 9 | 3 | ✅ COMPLETED |
| Phase 4 | US2 - Chat History Persistence | 8 | 2 | ✅ COMPLETED |
| Phase 5 | US3 - Source Code Persistence | 9 | 3 | ✅ COMPLETED |
| Phase 6 | US4 - Project Management | 5 | 2 | ✅ COMPLETED |
| Phase 7 | US5 - Project Status Workflow | 4 | 4 | ✅ **COMPLETED** (2025-12-20) |
| Phase 8 | Polish & Cross-Cutting | 5 | 2 | ✅ **COMPLETED** (2025-12-21) |

**Current Progress**: 55/55 tasks completed (100%) - **All phases complete, feature fully implemented**

## User Story Mapping

| Story | Priority | Independent Test | Key Deliverables |
|-------|----------|------------------|------------------|
| US1 | P1 | Create project, verify persists after logout/login | Project CRUD API, Create UI |
| US2 | P1 | Send messages, close browser, verify restored | Messages API, useChatHistory update |
| US3 | P1 | Generate code, close browser, verify files restored | Snapshot API, restore logic |
| US4 | P2 | Create multiple projects, test list/rename/delete | Project list UI, management actions |
| US5 | P2 | Change status, verify persists and filters work | Status update API, filter UI |

---

## Phase 1: Setup & Infrastructure ✅ COMPLETED

**Goal**: Initialize project structure and verify development environment

- [x] T001 Verify Supabase CLI is installed and local instance running (`supabase status`)
- [x] T002 Create feature branch tracking in git if not already on `001-user-project-tables`
- [x] T003 [P] Create TypeScript types file at `app/types/project.ts` with Project, ProjectMessage, ProjectSnapshot interfaces
- [x] T004 [P] Create Supabase client utility at `app/lib/db/supabase.server.ts` if not exists (export createClient with service key)
- [x] T005 Verify Better Auth session access pattern works by checking existing `app/routes/api.auth.$.ts`
- [x] T006 Create projects service file stub at `app/lib/services/projects.server.ts` with placeholder exports

**Completion Criteria**: ✅ Types compile, Supabase client exports work, service file exists

---

## Phase 2: Foundational (Database & Types) ✅ COMPLETED

**Goal**: Create database schema and RLS policies - blocks all user stories

### Database Migration

- [x] T007 Create migration file at `supabase/migrations/20251217000000_projects_schema.sql`
- [x] T008 [P] Add `projects` table with columns: id, user_id, tenant_id, name, description, status, url_id, created_at, updated_at
- [x] T009 [P] Add `project_messages` table with columns: id, project_id, message_id, sequence_num, role, content, annotations, created_at
- [x] T010 [P] Add `project_snapshots` table with columns: id, project_id, files (JSONB), summary, created_at, updated_at
- [x] T011 Add indexes for projects table: idx_projects_user_id, idx_projects_tenant_id, idx_projects_status, idx_projects_url_id
- [x] T012 Add indexes for project_messages: idx_project_messages_project_id, idx_project_messages_sequence
- [x] T013 Add indexes for project_snapshots: idx_project_snapshots_project_id
- [x] T014 Add RLS policies for all three tables (user access via app.current_user_id, service role bypass)

**Migration Verification**:
```bash
✅ supabase db reset  # Applied successfully
✅ supabase db diff   # No pending changes
```

### TypeScript Types (Complete)

- [x] T015 [P] Complete `app/types/project.ts` with full type definitions:
  - `ProjectStatus` type: 'draft' | 'published' | 'archived'
  - `Project` interface with all columns
  - `ProjectMessage` interface with all columns
  - `ProjectSnapshot` interface with FileMap reference
  - `CreateProjectInput`, `UpdateProjectInput` request types
  - `ProjectWithDetails` response type with business_profile

**Completion Criteria**: ✅ Migration applies cleanly, RLS blocks unauthorized access, types import without errors

---

## Phase 3: US1 - Create New Project ✅ COMPLETED

**Goal**: Users can create projects and see them persist across sessions

**Independent Test**: Login → Create project "Test Restaurant" → Logout → Login → Verify project exists in list

### Service Layer ✅

- [x] T016 [US1] Implement `createProject()` in `app/lib/services/projects.server.ts`:
  - Accept userId, name, description?, gmaps_url?, address?
  - Check project count < 10 (soft limit)
  - Generate unique url_id using nanoid or similar
  - Insert into projects table
  - Optionally create tenant + business_profile if gmaps_url provided
  - Return created Project

- [x] T017 [US1] Implement `getProjectsByUserId()` in `app/lib/services/projects.server.ts`:
  - Accept userId, optional status filter, limit, offset
  - Query projects table with RLS context set
  - Include message_count and has_snapshot in response
  - Return ProjectSummary[] with total count

- [x] T018 [US1] Implement `getProjectById()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, userId
  - Query project with tenant/business_profile join
  - Return ProjectWithDetails or null

### API Routes ✅

- [x] T019 [P] [US1] Create `app/routes/api.projects.ts` with loader and action:
  - `loader`: GET - call getProjectsByUserId, return JSON
  - `action`: POST - validate request, call createProject, return 201
  - Handle 401 if no session, 403 if limit reached

- [x] T020 [P] [US1] Create `app/routes/api.projects.$id.ts` with loader:
  - `loader`: GET - call getProjectById, return JSON or 404
  - Verify project belongs to user (RLS handles this)

### Frontend Integration ✅

- [x] T021 [US1] Create `app/lib/persistence/useProjects.ts` hook:
  - `useProjects()`: fetch project list from API
  - `createProject(name, options?)`: POST to API
  - Handle loading, error states
  - Return { projects, isLoading, error, createProject, refetch }

- [x] T022 [US1] Create project creation UI component at `app/components/projects/CreateProjectDialog.tsx`:
  - Modal/dialog with name input (required)
  - Optional description textarea
  - Optional Google Maps URL input
  - Submit button calls createProject hook
  - Show loading state, handle errors

- [x] T023 [US1] Create project list UI component at `app/components/projects/ProjectList.tsx`:
  - Display projects with name, status badge, last updated
  - Empty state with "Create your first project" CTA
  - Loading skeleton while fetching
  - Click handler to navigate to project

- [x] T024 [US1] Integrate project list into dashboard at `app/routes/app._index.tsx` or create new route:
  - Show ProjectList component
  - Add CreateProjectDialog trigger button
  - Handle navigation to selected project

**Completion Criteria**: ✅ User can create project via UI, see it in list, project persists after page reload

---

## Phase 4: US2 - Chat History Persistence (P1)

**Goal**: Chat messages persist to server and restore on project open

**Independent Test**: Open project → Send 3 messages → Close browser → Reopen project → All 3 messages visible

### Service Layer

- [x] T025 [US2] Implement `getMessagesByProjectId()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, limit (default 50), offset, order
  - Query project_messages with pagination
  - Return messages array and total count

- [x] T026 [US2] Implement `saveMessages()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, messages array
  - Upsert messages by (project_id, sequence_num)
  - Handle AI SDK Message format conversion
  - Return saved count

### API Routes

- [x] T027 [P] [US2] Create `app/routes/api.projects.$id.messages.ts`:
  - `loader`: GET - call getMessagesByProjectId with pagination params
  - `action`: POST - validate messages array, call saveMessages
  - Return appropriate status codes

### Frontend Integration

- [x] T028 [US2] Create server-side message functions in `app/lib/persistence/db.server.ts`:
  - `getServerMessages(projectId)`: fetch from API
  - `setServerMessages(projectId, messages)`: save to API
  - Match existing db.ts interface signatures

- [x] T029 [US2] Modify `app/lib/persistence/useChatHistory.ts` to use server storage:
  - Check if user is authenticated (has session)
  - If authenticated + has projectId: use db.server.ts functions
  - If not authenticated: fall back to IndexedDB (existing behavior)
  - Add projectId to hook parameters

- [x] T030 [US2] Update `app/routes/chat.$id.tsx` to pass projectId to useChatHistory:
  - Resolve urlId to projectId via API or URL structure
  - Pass projectId to useChatHistory hook
  - Handle loading state while resolving

- [x] T031 [US2] Implement message sync on chat send in `useChatHistory.ts`:
  - After storeMessageHistory, if authenticated, call setServerMessages
  - Debounce saves to avoid excessive API calls (500ms)
  - Handle save errors gracefully (show toast, retry logic)

- [x] T032 [US2] Implement message restore on project open:
  - In useChatHistory, if authenticated + projectId, fetch from server first
  - Populate initialMessages from server response
  - Set ready state after fetch completes

**Completion Criteria**: Messages sync to server on send, restore from server on project open

---

## Phase 5: US3 - Source Code Persistence (P1)

**Goal**: FileMap snapshots persist to server and restore to WebContainer

**Independent Test**: Generate code → See files in editor → Close browser → Reopen → All files present

### Service Layer

- [x] T033 [US3] Implement `getSnapshotByProjectId()` in `app/lib/services/projects.server.ts`:
  - Accept projectId
  - Query project_snapshots table
  - Return Snapshot or null

- [x] T034 [US3] Implement `saveSnapshot()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, files (FileMap), summary?
  - Validate snapshot size < 50MB
  - Upsert into project_snapshots (one per project)
  - Return updated_at timestamp

### API Routes

- [x] T035 [P] [US3] Create `app/routes/api.projects.$id.snapshot.ts`:
  - `loader`: GET - call getSnapshotByProjectId, return JSON or 404
  - `action`: PUT - validate FileMap, call saveSnapshot
  - Return 413 if snapshot too large

### Frontend Integration

- [x] T036 [US3] Add server snapshot functions to `app/lib/persistence/db.server.ts`:
  - `getServerSnapshot(projectId)`: fetch from API
  - `setServerSnapshot(projectId, files, summary?)`: save to API

- [x] T037 [US3] Modify `takeSnapshot` in `app/lib/persistence/useChatHistory.ts`:
  - After saving to IndexedDB (if enabled), also save to server if authenticated
  - Pass projectId to setServerSnapshot
  - Log success/failure

- [x] T038 [US3] Modify `restoreSnapshot` in `app/lib/persistence/useChatHistory.ts`:
  - If authenticated + projectId, fetch snapshot from server first
  - Fall back to IndexedDB snapshot if server returns null
  - Hydrate WebContainer with files from snapshot

- [x] T039 [P] [US3] Add snapshot size validation in frontend:
  - Before calling setServerSnapshot, estimate JSON size
  - If > 45MB, show warning to user
  - Suggest removing large binary files

- [x] T040 [US3] Implement snapshot restore on project open:
  - After fetching messages, also fetch snapshot
  - Call restoreSnapshot with server data
  - Show loading indicator during restore
  - Handle restore errors (show retry option)

- [x] T040a [P] [US3] Implement deployment package generation (FR-016) in `app/lib/services/projects.server.ts`:
  - Add `generateDeploymentPackage(projectId)` function
  - Fetch snapshot files from project_snapshots table
  - Convert FileMap to ZIP archive using jszip library
  - Return ZIP as Buffer for download or deployment upload
  - Add corresponding API endpoint if needed for direct download

**Completion Criteria**: ✅ Files persist to server, restore to WebContainer on project open, deployment ZIP can be generated

---

## Phase 6: US4 - Project Management (P2)

**Goal**: Users can list, rename, and delete their projects

**Independent Test**: Create 3 projects → Rename one → Delete one → Verify list shows 2 with correct names

### Service Layer ✅

- [x] T041 [US4] Implement `updateProject()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, userId, updates (name?, description?, status?)
  - Verify ownership via RLS
  - Update project, return updated Project

- [x] T042 [US4] Implement `deleteProject()` in `app/lib/services/projects.server.ts`:
  - Accept projectId, userId
  - Delete project (cascades to messages, snapshots)
  - Return success boolean

### API Routes ✅

- [x] T043 [P] [US4] Add PATCH and DELETE handlers to `app/routes/api.projects.$id.ts`:
  - `action` PATCH: validate update fields, call updateProject
  - `action` DELETE: call deleteProject, return 204
  - Handle 404 for non-existent projects

### Frontend Integration ✅

- [x] T044 [P] [US4] Add project actions to `app/lib/persistence/useProjects.ts`:
  - `renameProject(projectId, newName)`: PATCH to API
  - `deleteProject(projectId)`: DELETE to API
  - Optimistic updates with rollback on error

- [x] T045 [US4] Add project actions UI to `app/components/projects/ProjectList.tsx`:
  - Three-dot menu or action buttons per project
  - Rename: modal with name input and validation
  - Delete: confirmation dialog before delete
  - Show loading states during actions

**Completion Criteria**: ✅ All CRUD operations work via UI

## Phase 6 Implementation Status (2025-12-20)

**Phase 6: US4 - Project Management** ✅ **COMPLETED**

### Implemented Tasks:
- ✅ Service layer functions: `updateProject()`, `deleteProject()` (already existed)
- ✅ API routes: PATCH and DELETE handlers in `app/routes/api.projects.$id.ts` (already existed)
- ✅ Frontend hook: Added `renameProject()` convenience function to `useProjects.ts`
- ✅ UI components: Added `ProjectActions` dropdown menu with rename/delete functionality
- ✅ Dashboard integration: Updated `app/routes/app._index.tsx` to handle project actions

**Independent Test Ready**: Users can now create multiple projects, rename them, and delete them via the three-dot menu on each project card. All actions include proper validation, loading states, and error handling.

**Key Features Implemented**:
- Three-dot dropdown menu on each project card
- Rename modal with validation and keyboard shortcuts (Enter/Escape)
- Delete confirmation dialog with warning message
- Optimistic updates with rollback on error
- Loading states during rename/delete operations
- Proper error handling and user feedback

**Current Implementation Progress**: 49/55 tasks completed (89%)

**Ready for**: Phase 8 - Polish & Cross-Cutting Concerns implementation

---

## Phase 7: US5 - Project Status Workflow (P2) ✅ **COMPLETED** (2025-12-20)

**Goal**: Users can change project status and filter by status

**Independent Test**: Create project (draft) → Change to published → Filter by draft → Project hidden

### Implementation

- [x] T046 [US5] Add status update to project actions in `useProjects.ts`:
  - `updateProjectStatus(projectId, status)`: PATCH to API
  - Update local state optimistically

- [x] T047 [US5] Add status filter to `app/components/projects/ProjectList.tsx`:
  - Dropdown or tab selector for status filter
  - Pass status param to useProjects hook
  - Show "No projects" message when filter returns empty

- [x] T048 [US5] Add status badge and change UI to project list items:
  - Display current status as colored badge
  - Quick action to change status (dropdown or buttons)
  - "Publish" action sets status to 'published'
  - "Archive" action sets status to 'archived'

- [x] T049 [US5] Auto-update status on deployment:
  - In deployment flow, after successful deploy, call updateProjectStatus
  - Set status to 'published' automatically
  - Show success notification

**Completion Criteria**: ✅ Status changes persist, filters work correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Error handling, loading states, edge cases

### Error Handling

- [x] T050 Add global error boundary for project API errors:
  - Catch 401 (redirect to login)
  - Catch 403 (show limit reached message)
  - Catch 500 (show retry option)

- [x] T051 [P] Add retry logic to API calls in useProjects and useChatHistory:
  - Exponential backoff for failed saves
  - Maximum 3 retries
  - Show error toast after max retries

### Loading States

- [x] T052 [P] Add loading skeletons to ProjectList and chat components:
  - Skeleton cards for project list
  - Skeleton messages for chat history
  - Pulse animation during restore

### Soft Limit Enforcement

- [x] T053 Display project count and limit in UI:
  - "3 of 10 projects" indicator
  - Disable create button when at limit
  - Upgrade prompt when limit reached (future)

### Documentation

- [x] T054 Update README or create docs for project persistence:
  - API endpoint documentation
  - Error codes and meanings
  - Migration instructions

**Completion Criteria**: Smooth UX with proper error handling and feedback

---

## Dependency Graph

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Database) ─────────────────────────────────────┐
    │                                                    │
    ├──────────────┬──────────────┬──────────────┐      │
    ▼              ▼              ▼              ▼      │
Phase 3        Phase 4        Phase 5        Phase 6   │
(US1-Create)   (US2-Chat)     (US3-Code)     (US4-Mgmt)│
    │              │              │              │      │
    │              │              │              │      │
    │              ▼              │              │      │
    │         Phase 7 ◄──────────┴──────────────┘      │
    │         (US5-Status)                              │
    │              │                                    │
    └──────────────┴────────────────────────────────────┘
                   │
                   ▼
              Phase 8 (Polish)
```

**Key Dependencies**:
- Phase 2 blocks ALL user stories (database required)
- US1 (Phase 3) should complete before US2/US3 (need projects to exist)
- US4 and US5 can run in parallel after US1
- Phase 8 can start once any user story is complete

---

## Parallel Execution Opportunities

### Within Phase 2 (Database)
```
T008 (projects table) ─┐
T009 (messages table) ─┼─▶ T011-T014 (indexes, RLS)
T010 (snapshots table)─┘
```

### Within Phase 3 (US1)
```
T019 (api.projects.ts) ─────┐
                            ├─▶ T021-T024 (frontend)
T020 (api.projects.$id.ts) ─┘
```

### Across User Stories (after Phase 3)
```
Phase 4 (US2-Chat) ────┐
                       ├─▶ Run in parallel
Phase 5 (US3-Code) ────┘
```

---

## Implementation Strategy

### MVP Scope (Recommended First Delivery)

**Complete Phases 1-3 only** for initial MVP:
- ✅ Database schema
- ✅ Project CRUD
- ✅ Basic UI

This delivers **US1 (Create New Project)** as independently testable MVP.

### Incremental Delivery

1. **Week 1**: Phases 1-3 (Project creation works)
2. **Week 2**: Phases 4-5 (Chat + code persistence)
3. **Week 3**: Phases 6-8 (Management, status, polish)

### Testing Checkpoints

After each phase, verify:

| Phase | Verification |
|-------|--------------|
| 2 | `supabase db reset` succeeds, tables exist |
| 3 | Can create project via curl/UI, persists |
| 4 | Messages save and restore across sessions |
| 5 | Files restore to WebContainer correctly |
| 6 | Rename/delete work, list updates |
| 7 | Status filters work |
| 8 | Error states handled gracefully |

---

## File Reference

| File Path | Created In | Purpose |
|-----------|------------|---------|
| `supabase/migrations/20251217000000_projects_schema.sql` | T007-T014 | Database schema |
| `app/types/project.ts` | T003, T015 | TypeScript types |
| `app/lib/db/supabase.server.ts` | T004 | Supabase client |
| `app/lib/services/projects.server.ts` | T006, T016-T018, T025-T026, T033-T034, T040a, T041-T042 | Business logic |
| `app/routes/api.projects.ts` | T019 | List/Create API |
| `app/routes/api.projects.$id.ts` | T020, T043 | Get/Update/Delete API |
| `app/routes/api.projects.$id.messages.ts` | T027 | Messages API |
| `app/routes/api.projects.$id.snapshot.ts` | T035 | Snapshot API |
| `app/lib/persistence/useProjects.ts` | T021, T044, T046 | Projects hook |
| `app/lib/persistence/db.server.ts` | T028, T036 | Server DB operations |
| `app/lib/persistence/useChatHistory.ts` | T029-T032, T037-T038 | Modified for server |
| `app/components/projects/CreateProjectDialog.tsx` | T022 | Create UI |
| `app/components/projects/ProjectList.tsx` | T023, T045, T047-T048 | List UI |

