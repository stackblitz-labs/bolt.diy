-- Fix Google OAuth Authentication by disabling RLS on authentication tables
-- This allows Better Auth to operate without requiring tenant context

-- Disable RLS on authentication tables to allow Better Auth operations without tenant context
ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
ALTER TABLE session DISABLE ROW LEVEL SECURITY;
ALTER TABLE verification DISABLE ROW LEVEL SECURITY;
ALTER TABLE account DISABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies on auth tables (if they exist)
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "user";
DROP POLICY IF EXISTS "tenant_isolation_policy" ON session;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON verification;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON account;

-- Ensure user.tenant_id is nullable (allows users to exist without tenant assignment)
ALTER TABLE "user" ALTER COLUMN tenant_id DROP NOT NULL;

-- Keep RLS enabled on business data tables
-- These tables will continue to enforce tenant isolation when tenant context is set
-- Tables with RLS enabled: tenants, business_profiles, projects, messages

-- Note: Authentication can now proceed without tenant context,
-- while business data remains protected by tenant isolation when applicable