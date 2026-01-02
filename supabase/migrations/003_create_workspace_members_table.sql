/*
  # Create workspace_members table

  1. New Tables
    - `workspace_members`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, references workspaces.id)
      - `user_id` (uuid, references users.id)
      - `joined_at` (timestamptz)

  2. Security
    - Enable RLS on `workspace_members` table
    - Add policy for workspace members to read members
    - Add policy for workspace owner to add/remove members
    - Unique constraint on (workspace_id, user_id)
*/

CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspace members can read members of their workspaces
CREATE POLICY "Workspace members can read members"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspace owner can add members
CREATE POLICY "Workspace owner can add members"
  ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Workspace owner can remove members
CREATE POLICY "Workspace owner can remove members"
  ON workspace_members
  FOR DELETE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);

-- Update workspaces read policy to include members (now that workspace_members table exists)
DROP POLICY IF EXISTS "Workspace owners can read workspaces" ON workspaces;
CREATE POLICY "Workspace members can read workspaces"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );


