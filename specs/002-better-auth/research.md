# Research: Better Auth Authentication System

**Feature**: 002-better-auth  
**Date**: 2025-11-25  
**Status**: Complete

## Research Tasks & Findings

### 1. Better Auth Remix Integration

**Decision**: Use Better Auth's official Remix integration with catch-all route handler

**Rationale**: Better Auth provides first-class Remix support via `toRemixHandler()` adapter. This handles all auth routes under a single `api.auth.$.ts` file, matching Remix's file-based routing convention.

**Implementation Pattern** (from [Better Auth Remix Docs](https://www.better-auth.com/docs/integrations/remix)):

```typescript
// app/lib/auth/auth.server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "~/lib/db/drizzle.server";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

// app/routes/api.auth.$.ts
import { auth } from "~/lib/auth/auth.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
```

**Alternatives Considered**:
- remix-auth + remix-auth-oauth2: More manual setup, less integrated session management
- Custom OAuth implementation: Significantly more code, security risk

---

### 2. Database Adapter Selection

**Decision**: Use Drizzle adapter with PostgreSQL

**Rationale**: 
- Drizzle provides full schema generation AND migration support (Prisma only supports generation)
- Better Auth CLI can auto-generate schema: `npx @better-auth/cli generate`
- Type-safe queries align with existing TypeScript strict mode
- Works seamlessly with Supabase PostgreSQL

**Schema Generation**:
```bash
npx @better-auth/cli@latest generate --config ./app/lib/auth/auth.server.ts
```

This generates Drizzle schema with tables:
- `user` - Core user data
- `session` - Server-side sessions  
- `account` - OAuth provider linkages
- `verification` - Email verification tokens (optional)

**Alternatives Considered**:
- Prisma adapter: No migration support, would require manual sync
- Raw SQL: Loses type safety, more maintenance burden

---

### 3. Google OAuth Configuration

**Decision**: Use Better Auth's built-in Google provider with standard scopes

**Rationale**: Better Auth handles OAuth flow complexity including:
- PKCE by default
- Automatic token refresh
- Account linking by email
- Scope management via `linkSocial` for future expansion

**Required Setup**:
1. Google Cloud Console: Create OAuth 2.0 credentials
2. Authorized redirect URI: `{BASE_URL}/api/auth/callback/google`
3. Requested scopes: `openid`, `email`, `profile`

**Environment Variables**:
```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
BETTER_AUTH_SECRET=32-char-random-string
BETTER_AUTH_URL=https://huskit.app  # or http://localhost:5173 for dev
```

**Alternatives Considered**:
- Multiple OAuth providers: Defer to future; Google-only simplifies initial launch

---

### 4. Session Management Strategy

**Decision**: Server-side sessions with HTTP-only cookies, sliding window expiration

**Rationale**: Better Auth defaults (per [security reference](https://www.better-auth.com/docs/reference/security)):
- 7-day session lifetime
- Automatic refresh on activity
- Server-side storage prevents token theft
- HTTP-only cookies block XSS access

**Configuration**:
```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24,     // Refresh daily on activity
  cookieCache: {
    enabled: true,
    maxAge: 5 * 60,            // 5-minute client cache
  },
},
advanced: {
  useSecureCookies: process.env.NODE_ENV === "production",
  cookiePrefix: "huskit-auth",
},
```

**Alternatives Considered**:
- JWT-only: Client-side storage vulnerable to XSS, no revocation
- Redis session store: Over-engineering for current scale

---

### 5. Protected Route Implementation

**Decision**: Remix loader-based guards with helper utilities

**Rationale**: 
- Remix loaders run server-side before render
- Better Auth provides `auth.api.getSession()` for server-side session access
- Redirect unauthorized users to login with return URL

**Implementation Pattern**:
```typescript
// app/lib/auth/guards.server.ts
import { redirect } from "@remix-run/node";
import { auth } from "./auth.server";

export async function requireSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  
  if (!session) {
    const url = new URL(request.url);
    throw redirect(`/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
  }
  
  return session;
}

// Usage in protected route loader
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  // session.user available here
  return json({ user: session.user });
}
```

**API Route Protection**:
```typescript
export async function requireSessionOrError(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  
  if (!session) {
    throw json(
      { error: "Unauthorized", message: "Session expired or invalid" },
      { status: 401 }
    );
  }
  
  return session;
}
```

**Alternatives Considered**:
- Remix middleware (experimental): Not stable enough for production
- Client-side guards only: Server data leakage risk

---

### 6. Client-Side Session Access

**Decision**: Use Better Auth React client with `useSession` hook

**Rationale**: Provides reactive session state for UI updates without full page reload.

**Implementation**:
```typescript
// app/lib/auth/auth.client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

export const { signIn, signOut, useSession } = authClient;

// Component usage
function UserMenu() {
  const { data: session, isPending } = useSession();
  
  if (isPending) return <Spinner />;
  if (!session) return <SignInButton />;
  
  return <UserAvatar user={session.user} />;
}
```

---

### 7. Tenant Integration

**Decision**: Link Better Auth users to existing tenants table via foreign key

**Rationale**: 
- Preserve existing RLS policies and tenant isolation
- User records reference tenant_id after first sign-in
- Support multi-tenant access via junction table (future)

**Schema Extension**:
```sql
-- Add tenant linkage to Better Auth user table
ALTER TABLE "user" 
ADD COLUMN tenant_id UUID REFERENCES tenants(id);

-- Index for tenant queries
CREATE INDEX idx_user_tenant_id ON "user"(tenant_id);
```

**Alternatives Considered**:
- Separate user tables: Duplicates data, harder to maintain
- Tenant as Better Auth custom field: Less queryable

---

### 8. Security Event Logging

**Decision**: Use Better Auth hooks for security event capture

**Rationale**: FR-009 requires audit logging. Better Auth provides lifecycle hooks.

**Implementation**:
```typescript
export const auth = betterAuth({
  // ...config
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path.startsWith("/sign-in"),
        handler: async (ctx) => {
          logger.info("auth.sign_in", {
            userId: ctx.context.session?.user.id,
            provider: ctx.body?.provider,
            success: ctx.response.status === 200,
          });
        },
      },
    ],
  },
});
```

---

## Dependencies to Install

```bash
pnpm add better-auth drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit @better-auth/cli
```

Note: Using `@neondatabase/serverless` for Cloudflare Pages compatibility. For local dev, can use `postgres` package.

---

## Environment Variables Required

| Variable | Description | Example |
|----------|-------------|---------|
| `BETTER_AUTH_SECRET` | 32+ char random string for signing | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public URL of the app | `https://huskit.app` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-xxx` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Which database adapter? | Drizzle (supports schema generation + migration) |
| Session storage location? | PostgreSQL via Drizzle adapter |
| Cookie security settings? | HTTP-only, Secure in prod, SameSite=Lax |
| How to protect `/app/**`? | Remix loader guards with `requireSession()` |
| Tenant integration? | FK from user table to tenants |

