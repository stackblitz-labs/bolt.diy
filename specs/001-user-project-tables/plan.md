# Implementation Plan: User Project Tables

**Branch**: `001-user-project-tables` | **Date**: 2025-12-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-user-project-tables/spec.md`

## Summary

Add server-side project persistence to enable cross-device access to user projects, chat history, and generated source code. Replaces client-side IndexedDB storage with PostgreSQL (Supabase) while maintaining the same StackBlitz-style snapshot structure for minimal code changes.

**Technical Approach**: 
- Create new `projects` table linking users to tenants/business_profiles
- Store chat messages in `project_messages` table (mirrors IndexedDB `chats` structure)
- Store file snapshots as JSONB in `project_snapshots` table (mirrors IndexedDB `snapshots` structure)
- Add Remix API routes for CRUD operations
- Update frontend persistence layer to use API instead of IndexedDB

## Technical Context

**Language/Version**: TypeScript 5.7.2 on Node.js >=18.18.0  
**Primary Dependencies**: Remix 2.15.2, Supabase JS Client, Better Auth, Vercel AI SDK  
**Storage**: PostgreSQL (Supabase) with JSONB for snapshots  
**Testing**: Vitest for unit tests, Playwright for integration  
**Target Platform**: Web (Cloudflare Pages), Electron desktop  
**Project Type**: Web application (Remix full-stack)  
**Performance Goals**: <2s project creation, <3s chat load, <5s snapshot restore  
**Constraints**: 10 projects/user soft limit, ~100MB max project size, 500 messages before pagination  
**Scale/Scope**: Initial support for 1000 users, 10 projects each

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| Test-First | ✅ Pass | Unit tests for service layer, integration tests for API routes |
| Simplicity | ✅ Pass | Mirrors existing IndexedDB structure, minimal refactoring |
| Observability | ✅ Pass | Use existing logger patterns from `~/utils/logger` |

**Pre-Design Gate**: ✅ PASSED  
**Post-Design Gate**: ✅ PASSED (no additional complexity introduced)

## Project Structure

### Documentation (this feature)

```text
specs/001-user-project-tables/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── projects-api.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
# Database
supabase/migrations/
└── 20251217000000_projects_schema.sql    # New migration

# Backend API Routes
app/routes/
├── api.projects.ts                       # List/Create projects
├── api.projects.$id.ts                   # Get/Update/Delete project
├── api.projects.$id.messages.ts          # Get/Save messages
└── api.projects.$id.snapshot.ts          # Get/Save snapshot

# Services Layer
app/lib/services/
└── projects.server.ts                    # Project CRUD operations

# Frontend Persistence (modify existing)
app/lib/persistence/
├── db.ts                                 # Keep for local fallback
├── db.server.ts                          # NEW: Server-side operations
├── useChatHistory.ts                     # Modify to use API
└── useProjects.ts                        # NEW: Project management hook

# Types
app/types/
└── project.ts                            # NEW: Project type definitions
```

**Structure Decision**: Web application pattern - backend API routes in `app/routes/`, services in `app/lib/services/`, persistence layer adaptation in `app/lib/persistence/`.

## Implementation Phases

### Phase 1: Database & API Foundation
1. Create PostgreSQL migration for projects, messages, snapshots tables
2. Implement server-side service layer (`projects.server.ts`)
3. Create API routes for project CRUD
4. Add project list/create UI components

### Phase 2: Chat & Snapshot Integration  
1. Add messages API routes
2. Add snapshot API routes
3. Modify `useChatHistory` to use server API when authenticated
4. Implement snapshot save/restore via API

### Phase 3: Migration & Polish
1. Add project selector/switcher UI
2. Implement soft limit enforcement (10 projects)
3. Add loading states and error handling
4. Write integration tests

## Complexity Tracking

> No constitution violations requiring justification.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Storage format | JSONB snapshot (not per-file) | Matches existing IndexedDB structure, minimal code changes |
| Message storage | Separate table (not JSONB array) | Enables pagination, individual message queries |
| Tenant integration | Project links to tenant | Reuses existing business_profiles for address/gmaps data |

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Better Auth | ✅ Exists | User authentication in place |
| Tenants table | ✅ Exists | Project will link to tenant |
| Business Profiles | ✅ Exists | Stores address, gmaps_url, metadata |
| Supabase client | ✅ Exists | Database access configured |

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large JSONB snapshots | Add size check constraint (~50MB), document limits |
| Message count growth | Implement pagination from start, limit stored to 500 |
| Concurrent editing | Last-write-wins with `updated_at` timestamp check |
| API latency | Add loading states, optimistic updates for UX |

## Artifacts Generated

- [x] `plan.md` - This implementation plan
- [x] `research.md` - Design decisions and alternatives
- [x] `data-model.md` - Database schema documentation
- [x] `contracts/projects-api.yaml` - OpenAPI specification
- [x] `quickstart.md` - Development setup guide
