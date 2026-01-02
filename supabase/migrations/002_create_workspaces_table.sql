/*
  # Create workspaces table

  1. New Tables
    - `workspaces`
      - `id` (uuid, primary key)
      - `name` (text)
      - `owner_id` (uuid, references users.id)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `workspaces` table
    - Add policy for workspace members to read workspace
    - Add policy for workspace owner to update/delete workspace
*/

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace owners can read their workspaces
-- Note: Member access will be added in migration 003 after workspace_members table is created
CREATE POLICY "Workspace owners can read workspaces"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Workspace owner can update workspace
CREATE POLICY "Workspace owner can update workspace"
  ON workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Workspace owner can delete workspace
CREATE POLICY "Workspace owner can delete workspace"
  ON workspaces
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


