# Data Model: Better Auth Authentication System

**Feature**: 002-better-auth  
**Date**: 2025-11-25  
**Status**: Design Complete

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     tenants     │       │      user       │       │    account      │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ tenant_id (FK)  │       │ id (PK)         │
│ business_name   │       │ id (PK)         │◄──────│ user_id (FK)    │
│ status          │       │ name            │       │ provider_id     │
│ created_at      │       │ email           │       │ provider_account│
│ updated_at      │       │ email_verified  │       │ access_token    │
└─────────────────┘       │ image           │       │ refresh_token   │
                          │ created_at      │       │ expires_at      │
                          │ updated_at      │       │ scope           │
                          └─────────────────┘       │ created_at      │
                                  │                 │ updated_at      │
                                  │                 └─────────────────┘
                                  │
                                  ▼
                          ┌─────────────────┐
                          │    session      │
                          ├─────────────────┤
                          │ id (PK)         │
                          │ user_id (FK)    │
                          │ token           │
                          │ expires_at      │
                          │ ip_address      │
                          │ user_agent      │
                          │ created_at      │
                          │ updated_at      │
                          └─────────────────┘
```

## Entities

### 1. User (Better Auth Core)

Maps to spec entity: **AuthenticatedUser**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique user identifier |
| `name` | `VARCHAR(255)` | nullable | Display name from OAuth |
| `email` | `VARCHAR(255)` | NOT NULL, UNIQUE | User email address |
| `email_verified` | `BOOLEAN` | DEFAULT false | Email verification status |
| `image` | `TEXT` | nullable | Profile image URL |
| `tenant_id` | `UUID` | FK → tenants.id, nullable | Linked tenant (set post-onboarding) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Account creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last update time |

**Validation Rules**:
- Email must be valid format (enforced by Better Auth)
- Email uniqueness prevents duplicate accounts (FR-002)
- tenant_id nullable initially, set during workspace onboarding

**Indexes**:
- `idx_user_email` on `email` (unique)
- `idx_user_tenant_id` on `tenant_id` WHERE NOT NULL

---

### 2. Account (OAuth Provider Linkage)

Maps to spec entity: **OAuthAccount**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Unique account record ID |
| `user_id` | `UUID` | FK → user.id, NOT NULL | Parent user |
| `provider_id` | `VARCHAR(255)` | NOT NULL | OAuth provider name (e.g., "google") |
| `account_id` (`accountId`) | `VARCHAR(255)` | NOT NULL | Provider-issued user ID (Better Auth logical field `accountId`) |
| `access_token` | `TEXT` | nullable | Current access token |
| `refresh_token` | `TEXT` | nullable | Refresh token for renewal |
| `access_token_expires_at` | `TIMESTAMPTZ` | nullable | Token expiration |
| `scope` | `TEXT` | nullable | Granted OAuth scopes |
| `id_token` | `TEXT` | nullable | OIDC ID token |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Linkage creation |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last token refresh |

**Validation Rules**:
- Unique constraint on (`provider_id`, `account_id`)
- Cascading delete when parent user is deleted

**Indexes**:
- `idx_account_user_id` on `user_id`
- `idx_account_provider` on (`provider_id`, `account_id`) UNIQUE

---

### 3. Session (Server-Side Sessions)

Maps to spec entity: **SessionEnvelope**

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK, auto-generated | Session identifier |
| `user_id` | `UUID` | FK → user.id, NOT NULL | Session owner |
| `token` | `VARCHAR(255)` | NOT NULL, UNIQUE | Session token (cookie value) |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Session expiration |
| `ip_address` | `VARCHAR(45)` | nullable | Client IP (audit) |
| `user_agent` | `TEXT` | nullable | Browser/device info (audit) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Session start |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last activity |

**Validation Rules**:
- `expires_at` must be in future at creation
- Token is cryptographically random (32+ bytes)

**State Transitions**:
- **Active**: `expires_at > NOW()` and not deleted
- **Expired**: `expires_at <= NOW()`
- **Revoked**: Row deleted (sign-out)

**Indexes**:
- `idx_session_token` on `token` UNIQUE
- `idx_session_user_id` on `user_id`
- `idx_session_expires_at` on `expires_at` (for cleanup job)

---

### 4. Verification (Optional - Email Verification)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `UUID` | PK | Verification ID |
| `identifier` | `VARCHAR(255)` | NOT NULL | Email or phone |
| `value` | `VARCHAR(255)` | NOT NULL | Verification code |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Code expiration |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Creation time |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Update time |

**Note**: Only needed if email verification is enabled (not required for OAuth-only flow).

---

## Drizzle Schema Definition

```typescript
// app/lib/auth/schema.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex("idx_user_email").on(table.email),
  tenantIdx: index("idx_user_tenant_id").on(table.tenantId),
}));

export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex("idx_session_token").on(table.token),
  userIdx: index("idx_session_user_id").on(table.userId),
  expiresIdx: index("idx_session_expires_at").on(table.expiresAt),
}));

export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  accountId: varchar("provider_account_id", { length: 255 }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index("idx_account_user_id").on(table.userId),
  providerIdx: uniqueIndex("idx_account_provider").on(table.providerId, table.accountId),
}));

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## SQL Migration

```sql
-- supabase/migrations/20251125000000_better_auth_schema.sql

-- ============================================================================
-- BETTER AUTH USER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_tenant_id ON "user"(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- BETTER AUTH SESSION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_session_token ON session(token);
CREATE INDEX idx_session_user_id ON session(user_id);
CREATE INDEX idx_session_expires_at ON session(expires_at);

-- ============================================================================
-- BETTER AUTH ACCOUNT TABLE (OAuth Providers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS account (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider_id VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  id_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_account_id)
);

CREATE INDEX idx_account_user_id ON account(user_id);
CREATE UNIQUE INDEX idx_account_provider ON account(provider_id, provider_account_id);

-- ============================================================================
-- BETTER AUTH VERIFICATION TABLE (Optional)
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL,
  value VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER update_user_updated_at
  BEFORE UPDATE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_updated_at
  BEFORE UPDATE ON session
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_updated_at
  BEFORE UPDATE ON account
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY user_self_access ON "user"
  FOR SELECT
  USING (id = current_setting('app.current_user_id', TRUE)::UUID);

-- Service role bypass for auth operations
CREATE POLICY user_service_role ON "user"
  FOR ALL
  USING (current_setting('role', TRUE) = 'service_role');

-- Sessions: user can view own sessions
CREATE POLICY session_user_access ON session
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Service role can manage all sessions
CREATE POLICY session_service_role ON session
  FOR ALL
  USING (current_setting('role', TRUE) = 'service_role');

-- Accounts: user can view own accounts
CREATE POLICY account_user_access ON account
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);

-- Service role can manage all accounts
CREATE POLICY account_service_role ON account
  FOR ALL
  USING (current_setting('role', TRUE) = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE "user" IS 'Better Auth user accounts with tenant linkage';
COMMENT ON TABLE session IS 'Server-side session storage for Better Auth';
COMMENT ON TABLE account IS 'OAuth provider account linkages';
COMMENT ON TABLE verification IS 'Email/phone verification tokens';
```

---

## Relationships Summary

| Parent | Child | Relationship | On Delete |
|--------|-------|--------------|-----------|
| `user` | `session` | 1:N | CASCADE |
| `user` | `account` | 1:N | CASCADE |
| `tenants` | `user` | 1:N | SET NULL |

---

## Query Patterns

### Get user with tenant context
```sql
SELECT u.*, t.business_name
FROM "user" u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.id = $1;
```

### Active sessions for user
```sql
SELECT * FROM session
WHERE user_id = $1 AND expires_at > NOW()
ORDER BY created_at DESC;
```

### Check for existing OAuth account
```sql
SELECT u.* FROM "user" u
JOIN account a ON u.id = a.user_id
WHERE a.provider_id = 'google' 
  AND a.provider_account_id = $1;
```

