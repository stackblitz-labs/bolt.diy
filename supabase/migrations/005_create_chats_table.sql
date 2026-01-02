/*
  # Create chats table for workspace-aware chat storage

  1. New Tables
    - `chats`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, references workspaces.id)
      - `created_by` (uuid, references users.id)
      - `title` (text)
      - `description` (text)
      - `messages` (jsonb)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `chats` table
    - Add policy for workspace members to read chats
    - Add policy for workspace members to create chats
    - Add policy for workspace members to update chats
    - Add policy for workspace members to delete chats
*/

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title text,
  description text,
  messages jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Workspace members can read chats in their workspaces
CREATE POLICY "Workspace members can read chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can create chats
CREATE POLICY "Workspace members can create chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Workspace members can update chats in their workspaces
CREATE POLICY "Workspace members can update chats"
  ON chats
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace members can delete chats in their workspaces
CREATE POLICY "Workspace members can delete chats"
  ON chats
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_workspace_id ON chats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_by ON chats(created_by);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


