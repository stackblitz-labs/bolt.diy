# Quickstart: Better Auth Implementation

**Feature**: 002-better-auth  
**Date**: 2025-11-25  
**Estimated Time**: 4-6 hours

## Prerequisites

1. Google Cloud Console project with OAuth 2.0 credentials
2. Supabase project with PostgreSQL database
3. Node.js 18+ and pnpm installed

## Step 1: Install Dependencies

```bash
pnpm add better-auth drizzle-orm @neondatabase/serverless postgres
pnpm add -D drizzle-kit @better-auth/cli @types/node
```

## Step 2: Environment Setup

Add to `.env.local`:

```env
# Better Auth
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:5173

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
```

## Step 3: Run Database Migration

```bash
# Apply the auth schema migration
pnpm exec supabase db push
# Or manually via Supabase dashboard
```

## Step 4: Create Auth Server Module

Create `app/lib/auth/auth.server.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "~/lib/db/drizzle.server";
import * as schema from "./schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // Refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "huskit-auth",
  },
});

export type Session = typeof auth.$Infer.Session;
```

## Step 5: Create Auth API Route

Create `app/routes/api.auth.$.ts`:

```typescript
import { auth } from "~/lib/auth/auth.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  return auth.handler(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return auth.handler(request);
}
```

## Step 6: Create Auth Client

Create `app/lib/auth/auth.client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

export const { signIn, signOut, useSession } = authClient;
```

## Step 7: Create Route Guards

Create `app/lib/auth/guards.server.ts`:

```typescript
import { redirect, json } from "@remix-run/node";
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

export async function getOptionalSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}
```

## Step 8: Create Login Page

Create `app/routes/auth.login.tsx`:

```typescript
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { getOptionalSession } from "~/lib/auth/guards.server";
import { authClient } from "~/lib/auth/auth.client";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getOptionalSession(request);
  
  if (session) {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get("returnTo") || "/app";
    throw redirect(returnTo);
  }
  
  return json({});
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app";
  
  const handleGoogleSignIn = () => {
    authClient.signIn.social({
      provider: "google",
      callbackURL: returnTo,
    });
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-bold text-center">Sign in to Huskit</h1>
        
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 rounded-lg border px-4 py-3 hover:bg-gray-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      {/* Google G logo SVG path */}
    </svg>
  );
}
```

## Step 9: Protect a Route

Update any `/app/*` route loader:

```typescript
// app/routes/app.dashboard.tsx
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireSession } from "~/lib/auth/guards.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireSession(request);
  
  return json({
    user: session.user,
  });
}

export default function Dashboard() {
  // Component using loader data
}
```

## Step 10: Add User Menu Component

Create `app/components/auth/UserMenu.tsx`:

```typescript
import { useSession, signOut } from "~/lib/auth/auth.client";

export function UserMenu() {
  const { data: session, isPending } = useSession();
  
  if (isPending) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />;
  }
  
  if (!session) {
    return (
      <a href="/auth/login" className="text-sm font-medium">
        Sign in
      </a>
    );
  }
  
  return (
    <div className="flex items-center gap-4">
      <img
        src={session.user.image || "/default-avatar.png"}
        alt={session.user.name || "User"}
        className="h-8 w-8 rounded-full"
      />
      <button
        onClick={() => signOut({ fetchOptions: { onSuccess: () => window.location.href = "/" } })}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        Sign out
      </button>
    </div>
  );
}
```

## Verification Checklist

- [ ] Google OAuth credentials configured in Cloud Console
- [ ] Redirect URI set to `{BETTER_AUTH_URL}/api/auth/callback/google`
- [ ] Database migration applied
- [ ] `.env.local` has all required variables
- [ ] Can sign in via Google and see session created
- [ ] Protected routes redirect to login when unauthenticated
- [ ] Sign out clears session and redirects to home

## Common Issues

### "Invalid redirect_uri"
- Ensure `BETTER_AUTH_URL` matches your dev server (e.g., `http://localhost:5173`)
- Add exact callback URL in Google Cloud Console

### Session not persisting
- Check `BETTER_AUTH_SECRET` is set
- Verify cookies are not blocked by browser
- Check `useSecureCookies` is `false` for HTTP localhost

### Database connection errors
- Verify `DATABASE_URL` is correct Supabase connection string
- Check Supabase project is running

