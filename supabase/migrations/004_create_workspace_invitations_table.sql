/*
  # Create workspace_invitations table

  1. New Tables
    - `workspace_invitations`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, references workspaces.id)
      - `email` (text)
      - `invited_by` (uuid, references users.id)
      - `token` (text, unique)
      - `status` (text: 'pending' | 'accepted' | 'declined')
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `workspace_invitations` table
    - Add policy for workspace owner to manage invitations
    - Add policy for users to read their own invitations
*/

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace owner can read all invitations for their workspaces
CREATE POLICY "Workspace owner can read invitations"
  ON workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Users can read invitations sent to their email
CREATE POLICY "Users can read own invitations"
  ON workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Workspace owner can create invitations
CREATE POLICY "Workspace owner can create invitations"
  ON workspace_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Workspace owner can update invitations
CREATE POLICY "Workspace owner can update invitations"
  ON workspace_invitations
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Users can update their own invitations (to accept/decline)
CREATE POLICY "Users can update own invitations"
  ON workspace_invitations
  FOR UPDATE
  TO authenticated
  USING (
    email = (SELECT email FROM users WHERE id = auth.uid())
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_status ON workspace_invitations(status);


