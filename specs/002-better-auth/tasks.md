# Tasks: Better Auth Authentication System

**Input**: Design documents from `/specs/002-better-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Optional (TDD mentioned in constitution but not explicitly required)

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1, US2, US3)
- Paths based on plan.md Remix structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure environment

- [X] T001 Install Better Auth and Drizzle dependencies: `pnpm add better-auth drizzle-orm postgres`
- [X] T002 Install dev dependencies: `pnpm add -D drizzle-kit @better-auth/cli @types/node`
- [X] T003 [P] Add auth environment variables to `.env.example` (BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [X] T004 [P] Update `app/lib/config/env.server.ts` with Better Auth env schema validation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and core auth infrastructure - MUST complete before user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Schema

- [X] T005 Create database migration file `supabase/migrations/20251125000000_better_auth_schema.sql` with user, session, account tables (per data-model.md)
- [X] T006 Run migration: Automated script created - run `pnpm run migrate:auth` (uses DATABASE_URL from .env.local)

### Drizzle ORM Setup

- [X] T007 Create Drizzle client singleton in `app/lib/db/drizzle.server.ts`
- [X] T008 Create Drizzle schema definitions in `app/lib/auth/schema.ts` (user, session, account, verification tables)

### Better Auth Server Instance

- [X] T009 Create Better Auth server instance in `app/lib/auth/auth.server.ts` with:
  - Drizzle adapter configured for PostgreSQL
  - Google OAuth provider with clientId/clientSecret from env
  - Session config: 7-day expiry, daily refresh, HTTP-only cookies
  - Cookie prefix: "huskit-auth"
  - Export auth instance and Session type

### API Route Handler

- [X] T010 Create catch-all auth route `app/routes/api.auth.$.ts` with loader and action calling `auth.handler(request)`

**Checkpoint**: Foundation ready - Better Auth server running, database tables created

---

## Phase 3: User Story 1 - Google Onboarding in One Click (Priority: P1) 🎯 MVP

**Goal**: Users can sign up/sign in via Google OAuth and land in workspace with active session

**Independent Test**: Click "Continue with Google" from clean browser → complete consent → verify user record + session created → redirected to dashboard

**Maps to**: FR-001, FR-002, FR-003, FR-004, SC-001

### Implementation for User Story 1

- [X] T011 [P] [US1] Create Better Auth React client in `app/lib/auth/auth.client.ts` with createAuthClient, export signIn, signOut, useSession
- [X] T012 [P] [US1] Create GoogleSignInButton component in `app/components/auth/GoogleSignInButton.tsx` using authClient.signIn.social({ provider: "google" })
- [X] T013 [US1] Create login page route `app/routes/auth.login.tsx` with:
  - Loader checking existing session (redirect if authenticated)
  - returnTo query parameter support
  - GoogleSignInButton component
  - Styled login form matching Huskit design
- [X] T014 [US1] Create UserMenu component in `app/components/auth/UserMenu.tsx` with:
  - useSession hook for reactive state
  - User avatar and name display
  - Sign out button
  - Loading state handling
- [X] T015 [US1] Add security event logging hook to auth.server.ts for sign-in events (FR-009)
- [X] T016 [US1] Test Google OAuth flow end-to-end: sign up new user, verify database records (user, account, session tables)

**Checkpoint**: User Story 1 complete - Google sign-in working, user can authenticate

---

## Phase 4: User Story 2 - Session Continuity & Recovery (Priority: P2)

**Goal**: Sessions persist across tabs, auto-refresh on activity, explicit sign-out invalidates all sessions

**Independent Test**: Verify session creation, renewal, expiration, and revocation via session table inspection

**Maps to**: FR-005, FR-006, FR-008, SC-002

### Implementation for User Story 2

- [X] T017 [P] [US2] Create session utilities in `app/lib/auth/session.server.ts` with:
  - getSession(request) helper
  - getOptionalSession(request) for optional auth checks
  - Session type exports
- [X] T018 [US2] Create logout action route `app/routes/auth.logout.tsx` with:
  - Action calling signOut
  - Redirect to home after sign-out
  - Clear all sessions for user
- [X] T019 [US2] Add session list endpoint support via Better Auth's /list-sessions (FR-010)
- [X] T020 [US2] Add session revocation endpoint support via Better Auth's /revoke-session (FR-010)
- [X] T021 [US2] Create AuthGuard client component in `app/components/auth/AuthGuard.tsx` for:
  - Client-side session status checking
  - Redirect to login on session expiry
  - Loading state during session validation
- [X] T022 [US2] Add security event logging for sign-out events in auth.server.ts hooks (FR-009)
- [ ] T023 [US2] Test session lifecycle: creation, refresh on activity, manual sign-out, multi-tab behavior

**Checkpoint**: User Story 2 complete - Sessions persist, auto-refresh, sign-out works

---

## Phase 5: User Story 3 - Protected Workspace Navigation (Priority: P3)

**Goal**: All `/app/**` routes require authentication, unauthenticated requests redirect to login

**Independent Test**: Route guard tests asserting authorized requests succeed, unauthorized redirect/401

**Maps to**: FR-007, FR-008, SC-003

### Implementation for User Story 3

- [X] T024 [P] [US3] Create route guard utilities in `app/lib/auth/guards.server.ts` with:
  - requireSession(request) - throws redirect to login with returnTo
  - requireSessionOrError(request) - throws 401 JSON for API routes
  - Type-safe session return
- [X] T025 [US3] Update root loader in `app/root.tsx` to optionally load session for header UserMenu
- [X] T026 [US3] Create protected route example `app/routes/app._index.tsx` with requireSession in loader
- [ ] T027 [US3] Apply requireSession guard to existing `/app` routes (update loaders)
- [X] T028 [US3] Apply requireSessionOrError guard to protected API routes (e.g., api.chat.ts, api.enhancer.ts)
- [X] T029 [US3] Add returnTo parameter handling: capture original URL, redirect back after auth
- [ ] T030 [US3] Test route protection: unauthorized request → redirect to login with returnTo, authorized → success

**Checkpoint**: User Story 3 complete - All workspace routes protected

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, error handling, and integration improvements

- [X] T031 [P] Handle OAuth error edge cases in login page (consent denied, scope rejection)
- [X] T032 [P] Add account linking handling for existing email in auth.server.ts (FR-002)
- [X] T033 [P] Implement error boundary for auth failures in `app/components/auth/AuthErrorBoundary.tsx`
- [X] T034 Add database connection error fallback mode (session store unavailable)
- [X] T035 Integrate UserMenu into header component `app/components/header/Header.tsx`
- [ ] T036 Update `.cursor/rules/specify-rules.mdc` with auth module documentation
- [ ] T037 Run quickstart.md validation: verify all steps work as documented
- [ ] T038 Security audit: verify HTTP-only cookies, PKCE enabled, secure cookie flag in prod

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 - MVP target
- **User Story 2 (Phase 4)**: Depends on Phase 2, integrates with US1
- **User Story 3 (Phase 5)**: Depends on Phase 2, integrates with US1/US2
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (P1) | Foundational only | Phase 2 complete |
| US2 (P2) | Foundational only | Phase 2 complete (parallel with US1) |
| US3 (P3) | Foundational only | Phase 2 complete (parallel with US1/US2) |

### Within Each User Story

1. Client utilities before components
2. Components before routes
3. Core flow before edge cases
4. Test after implementation

### Parallel Opportunities

**Phase 1**:
- T003, T004 can run in parallel

**Phase 2**:
- T007, T008 can run in parallel after T005-T006

**User Stories (after Phase 2)**:
- US1, US2, US3 can all start in parallel
- Within US1: T011, T012 can run in parallel
- Within US2: T017 independent
- Within US3: T024 independent
- Within Phase 6: T031, T032, T033 can run in parallel

---

## Parallel Example: Phase 2 Completion

```bash
# After migration applied (T005-T006), launch database layer in parallel:
Task T007: "Create Drizzle client singleton in app/lib/db/drizzle.server.ts"
Task T008: "Create Drizzle schema definitions in app/lib/auth/schema.ts"

# Then auth server (depends on T007, T008):
Task T009: "Create Better Auth server instance in app/lib/auth/auth.server.ts"
```

## Parallel Example: User Story 1 Launch

```bash
# After Phase 2, launch US1 client-side modules in parallel:
Task T011: "Create Better Auth React client in app/lib/auth/auth.client.ts"
Task T012: "Create GoogleSignInButton component in app/components/auth/GoogleSignInButton.tsx"

# Then build login page (depends on T011, T012):
Task T013: "Create login page route app/routes/auth.login.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (30 min)
2. Complete Phase 2: Foundational (2-3 hours)
3. Complete Phase 3: User Story 1 (2-3 hours)
4. **STOP and VALIDATE**: Test Google sign-in end-to-end
5. Deploy/demo if ready - users can now authenticate!

### Incremental Delivery

| Increment | Deliverable | Time Est |
|-----------|-------------|----------|
| MVP | Google sign-in works | ~6 hours |
| +US2 | Session management | ~3 hours |
| +US3 | Route protection | ~2 hours |
| +Polish | Production ready | ~2 hours |

### Recommended Execution Order

1. T001-T010 (Setup + Foundational) - Sequential, blocking
2. T011-T016 (US1) - MVP delivery point
3. T017-T023 (US2) - Session management
4. T024-T030 (US3) - Route protection
5. T031-T038 (Polish) - Production hardening

---

## Notes

- Better Auth handles OAuth complexity (PKCE, token refresh, account linking)
- Use `auth.handler(request)` for all auth routes - Better Auth routes automatically
- Session stored in PostgreSQL via Drizzle adapter
- Cookies are HTTP-only by default (XSS protection)
- returnTo pattern preserves user navigation intent
- Each user story checkpoint: test independently before continuing

---

## Summary

| Metric | Count |
|--------|-------|
| Total Tasks | 38 |
| Setup Tasks | 4 |
| Foundational Tasks | 6 |
| US1 Tasks | 6 |
| US2 Tasks | 7 |
| US3 Tasks | 7 |
| Polish Tasks | 8 |
| Parallelizable Tasks | 15 |
| MVP Tasks (T001-T016) | 16 |

