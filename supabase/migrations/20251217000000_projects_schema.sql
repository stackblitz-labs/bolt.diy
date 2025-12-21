-- Migration: User Project Tables
-- Description: Create tables for user projects, chat messages, and file snapshots
-- Feature: 001-user-project-tables

-- ============================================================================
-- Projects Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  url_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Project Messages Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  sequence_num INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content JSONB NOT NULL,
  annotations JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique message per project and sequence
  UNIQUE(project_id, sequence_num),
  UNIQUE(project_id, message_id)
);

-- ============================================================================
-- Project Snapshots Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS project_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  files JSONB NOT NULL,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one snapshot per project
  UNIQUE(project_id)
);

-- ============================================================================
-- Indexes - Projects Table
-- ============================================================================

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Index for URL-based lookups
CREATE INDEX IF NOT EXISTS idx_projects_url_id ON projects(url_id) WHERE url_id IS NOT NULL;

-- Composite index for user project lists
CREATE INDEX IF NOT EXISTS idx_projects_user_status_updated ON projects(user_id, status, updated_at DESC);

-- ============================================================================
-- Indexes - Project Messages Table
-- ============================================================================

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);

-- Index for sequence ordering
CREATE INDEX IF NOT EXISTS idx_project_messages_sequence ON project_messages(project_id, sequence_num);

-- ============================================================================
-- Indexes - Project Snapshots Table
-- ============================================================================

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_snapshots_project_id ON project_snapshots(project_id);

-- ============================================================================
-- Trigger for updated_at columns
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_snapshots_updated_at BEFORE UPDATE ON project_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;

-- Note: app.current_user_id will be set using PostgreSQL's set_config()
-- function from the application layer when creating user contexts

-- ============================================================================
-- RLS Policies - Projects Table
-- ============================================================================

-- Users can view their own projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    -- Service role can bypass RLS (when running migrations or admin operations)
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects" ON projects
  FOR INSERT WITH CHECK (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Users can update their own projects
CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (
    current_setting('app.current_user_id', true)::uuid = user_id OR
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- ============================================================================
-- RLS Policies - Project Messages Table
-- ============================================================================

-- Users can view messages for their own projects
CREATE POLICY "Users can view own project messages" ON project_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can insert messages for their own projects
CREATE POLICY "Users can insert own project messages" ON project_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can update messages for their own projects
CREATE POLICY "Users can update own project messages" ON project_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can delete messages for their own projects
CREATE POLICY "Users can delete own project messages" ON project_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_messages.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- ============================================================================
-- RLS Policies - Project Snapshots Table
-- ============================================================================

-- Users can view snapshots for their own projects
CREATE POLICY "Users can view own project snapshots" ON project_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can insert snapshots for their own projects
CREATE POLICY "Users can insert own project snapshots" ON project_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can update snapshots for their own projects
CREATE POLICY "Users can update own project snapshots" ON project_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- Users can delete snapshots for their own projects
CREATE POLICY "Users can delete own project snapshots" ON project_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_snapshots.project_id
      AND (current_setting('app.current_user_id', true)::uuid = projects.user_id OR
           current_setting('request.jwt.claims', true)::json->>'role' = 'service_role')
    )
  );

-- ============================================================================
-- Comments and Notes
-- ============================================================================

-- The app.current_user_id() function should be set by the application
-- using createUserSupabaseClient() which calls set_config('app.current_user_id', userId)

-- Service role operations (like background jobs) can bypass RLS by setting
-- the JWT claim role to 'service_role'

-- The projects table has a soft limit of 10 projects per user enforced
-- at the application level (not database constraints)

-- The project_snapshots table has a unique constraint to ensure only
-- one snapshot per project (latest state)