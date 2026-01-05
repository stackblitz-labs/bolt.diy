/*
  # Create chat_presence table for tracking active users in chats

  1. New Tables
    - `chat_presence`
      - `id` (uuid, primary key)
      - `chat_id` (bigint, references chats.id)
      - `user_id` (uuid, references users.id)
      - `status` (text) - 'viewing' or 'editing'
      - `last_seen` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `chat_presence` table
    - Users can read presence for chats they have access to
    - Users can insert/update their own presence
    - Users can delete their own presence
    - Unique constraint on (chat_id, user_id)
*/

CREATE TABLE IF NOT EXISTS chat_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'viewing' CHECK (status IN ('viewing', 'editing')),
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(chat_id, user_id)
);

ALTER TABLE chat_presence ENABLE ROW LEVEL SECURITY;

-- Users can read presence for chats they have access to
CREATE POLICY "Users can read presence for accessible chats"
  ON chat_presence
  FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM chats
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
        UNION
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can insert their own presence
CREATE POLICY "Users can insert own presence"
  ON chat_presence
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND chat_id IN (
      SELECT id FROM chats
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
        UNION
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update their own presence
CREATE POLICY "Users can update own presence"
  ON chat_presence
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own presence
CREATE POLICY "Users can delete own presence"
  ON chat_presence
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_presence_chat_id ON chat_presence(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_presence_user_id ON chat_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_presence_last_seen ON chat_presence(last_seen);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_chat_presence_updated_at
  BEFORE UPDATE ON chat_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for chat_presence
ALTER PUBLICATION supabase_realtime ADD TABLE chat_presence;
ALTER TABLE chat_presence REPLICA IDENTITY FULL;
