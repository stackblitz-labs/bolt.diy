-- Track deployments for status, cleanup, and analytics
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  chat_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('amplify', 'cloudflare', 'netlify', 'vercel')),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('user-token', 'platform-managed')),
  external_id TEXT,           -- Platform's deployment/job ID
  external_project_id TEXT,   -- Platform's project/app/branch ID
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'uploading', 'ready', 'error')),
  url TEXT,
  error TEXT,
  file_count INTEGER,
  total_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ      -- For TTL cleanup of platform-managed deployments
);

-- Indexes for common queries
CREATE INDEX idx_deployments_user ON deployments(user_id);
CREATE INDEX idx_deployments_chat ON deployments(chat_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_platform ON deployments(platform);
CREATE INDEX idx_deployments_expires ON deployments(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_deployments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deployments_updated_at ON deployments;
CREATE TRIGGER deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_deployments_updated_at();

-- RLS policies
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Users can read their own deployments
CREATE POLICY "Users can read own deployments"
  ON deployments FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own deployments
CREATE POLICY "Users can insert own deployments"
  ON deployments FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own deployments
CREATE POLICY "Users can update own deployments"
  ON deployments FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do anything (for cleanup jobs)
CREATE POLICY "Service role full access"
  ON deployments FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

