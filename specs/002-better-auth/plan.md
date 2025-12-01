# Implementation Plan: Better Auth Authentication System

**Branch**: `002-better-auth` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-better-auth/spec.md`

## Summary

Implement a complete authentication system using Better Auth with Google OAuth, server-managed sessions in PostgreSQL/Supabase, and protected route guards for the `/app/**` workspace routes. The system will use Better Auth's Remix integration with Drizzle adapter for type-safe database operations, integrating with the existing tenant isolation model.

## Technical Context

**Language/Version**: TypeScript 5.7.2 on Node 18 (Remix + Vite runtime)  
**Primary Dependencies**: Better Auth ^1.2.x, Drizzle ORM, @remix-run/node, zod  
**Storage**: PostgreSQL (Supabase) - extends existing schema with Better Auth tables  
**Testing**: Vitest with @testing-library/react  
**Target Platform**: Cloudflare Pages (web), Electron (desktop)  
**Project Type**: Web application (Remix fullstack)  
**Performance Goals**: OAuth completion <30s (SC-001), session validation <50ms p95  
**Constraints**: HTTP-only cookies, no client-side token storage, RLS compatibility  
**Scale/Scope**: Multi-tenant SaaS, ~10k users initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Library-First | ✅ PASS | Better Auth is a well-maintained OSS library |
| Test-First | ✅ PASS | Will write loader/action tests before implementation |
| Simplicity | ✅ PASS | Using Better Auth's built-in patterns, minimal custom code |
| Observability | ✅ PASS | Security event logging via existing telemetry |

## Project Structure

### Documentation (this feature)

```text
specs/002-better-auth/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── auth-api.yaml    # OpenAPI spec for auth endpoints
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── auth/
│   │   ├── auth.server.ts       # Better Auth instance (server-only)
│   │   ├── auth.client.ts       # Better Auth client hooks
│   │   ├── session.server.ts    # Session utilities for loaders
│   │   ├── guards.server.ts     # Route protection helpers
│   │   └── schema.ts            # Drizzle schema for auth tables
│   └── db/
│       └── drizzle.server.ts    # Drizzle client singleton
├── routes/
│   ├── api.auth.$.ts            # Better Auth catch-all route handler
│   ├── auth.login.tsx           # Login page with Google button
│   ├── auth.logout.tsx          # Logout action route
│   └── auth.callback.tsx        # OAuth callback handler (if needed)
├── components/
│   └── auth/
│       ├── GoogleSignInButton.tsx
│       ├── UserMenu.tsx
│       └── AuthGuard.tsx        # Client-side session check wrapper

supabase/
└── migrations/
    └── 20251125000000_better_auth_schema.sql  # Auth tables migration

tests/
├── unit/
│   └── auth/
│       ├── guards.test.ts
│       └── session.test.ts
└── integration/
    └── auth/
        └── oauth-flow.test.ts
```

**Structure Decision**: Follows existing Remix + Vite patterns. Auth modules live in `app/lib/auth/` following the `.server.ts` convention for server-only code. Database layer uses Drizzle ORM for type-safety with Better Auth's schema.

## Complexity Tracking

> **No violations identified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
