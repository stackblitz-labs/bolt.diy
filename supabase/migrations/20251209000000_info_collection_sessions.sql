-- Info Collection Sessions Schema
-- Stores user-provided information for website generation

CREATE TABLE IF NOT EXISTS info_collection_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,

  -- Collected data
  website_url TEXT,
  website_url_validated BOOLEAN DEFAULT FALSE,
  google_maps_url TEXT,
  google_maps_url_validated BOOLEAN DEFAULT FALSE,
  website_description TEXT,

  -- Session state
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'crawler_queued', 'crawler_completed', 'cancelled')),
  chat_id VARCHAR(255),
  current_step VARCHAR(50) DEFAULT 'website_url'
    CHECK (current_step IN ('website_url', 'google_maps_url', 'description', 'review', 'completed')),

  -- Crawler integration
  crawler_job_id UUID,
  crawler_output JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX idx_ics_user_id ON info_collection_sessions(user_id);
CREATE INDEX idx_ics_status ON info_collection_sessions(status);
CREATE INDEX idx_ics_user_status ON info_collection_sessions(user_id, status);
CREATE INDEX idx_ics_user_active ON info_collection_sessions(user_id)
  WHERE status = 'in_progress';

-- Enable RLS
ALTER TABLE info_collection_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY ics_user_isolation ON info_collection_sessions
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', TRUE));

-- Service role bypass for server-side operations
CREATE POLICY ics_service_bypass ON info_collection_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Updated_at trigger (uses existing function from phase1_core)
CREATE TRIGGER update_ics_updated_at
  BEFORE UPDATE ON info_collection_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE info_collection_sessions IS 'User information collection sessions for website generation';
COMMENT ON COLUMN info_collection_sessions.crawler_output IS 'Enriched data following production_master_map schema';

