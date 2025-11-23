-- Places Crawler Service Schema Extensions
-- Extends crawled_data table with multi-source provenance, cache TTL, and stricter status constraints
-- Based on specs/001-places-crawler/data-model.md

-- ============================================================================
-- EXTEND CRAWLED_DATA TABLE
-- ============================================================================
-- Add new columns for multi-source tracking, cache management, and provenance

-- Add sources_used column to track which sources contributed data
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS sources_used JSONB DEFAULT '[]' CHECK (
  jsonb_typeof(sources_used) = 'array'
);

COMMENT ON COLUMN crawled_data.sources_used IS 'Array of source objects with type (maps/website/social) and timestamp for provenance tracking';

-- Add raw_payload_ref column to store full response payload reference
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS raw_payload_ref TEXT;

COMMENT ON COLUMN crawled_data.raw_payload_ref IS 'Reference to full raw payload storage (R2/S3 key or inline JSONB path)';

-- Add normalized_summary column for content agent consumption
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS normalized_summary JSONB DEFAULT '{}' CHECK (
  jsonb_typeof(normalized_summary) = 'object'
);

COMMENT ON COLUMN crawled_data.normalized_summary IS 'Normalized subset of data optimized for content agent processing';

-- Add cache_expires_at column for TTL management (default 24h from creation)
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS cache_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN crawled_data.cache_expires_at IS 'Cache expiration timestamp (created_at + 24h default, updated on force-refresh)';

-- Add place_id column for unique business identification
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS place_id VARCHAR(255);

COMMENT ON COLUMN crawled_data.place_id IS 'Unique place identifier (Google Place ID or derived from source URL)';

-- Add updated_at column for tracking modifications
ALTER TABLE crawled_data
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================================
-- UPDATE STATUS CONSTRAINT
-- ============================================================================
-- Drop old constraint and add new one with 'invalidated' status
ALTER TABLE crawled_data
DROP CONSTRAINT IF EXISTS crawled_data_status_check;

ALTER TABLE crawled_data
ADD CONSTRAINT crawled_data_status_check CHECK (
  status IN ('pending', 'completed', 'failed', 'invalidated')
);

COMMENT ON COLUMN crawled_data.status IS 'Crawl status: pending (in-flight), completed (success), failed (error), invalidated (manual cache clear)';

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================
-- Composite index for cache lookups by tenant and place
CREATE INDEX IF NOT EXISTS idx_crawled_data_tenant_place
ON crawled_data(tenant_id, place_id)
WHERE place_id IS NOT NULL;

-- Index for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_crawled_data_cache_expires
ON crawled_data(cache_expires_at)
WHERE cache_expires_at IS NOT NULL;

-- Index for status filtering (extend existing)
DROP INDEX IF EXISTS idx_crawled_data_status;
CREATE INDEX idx_crawled_data_status ON crawled_data(status);

-- ============================================================================
-- UPDATE EXISTING ROWS
-- ============================================================================
-- Set cache_expires_at for existing completed rows (24h from crawled_at)
UPDATE crawled_data
SET cache_expires_at = crawled_at + INTERVAL '24 hours'
WHERE status = 'completed' AND cache_expires_at IS NULL;

-- Migrate raw_data_blob to raw_payload_ref pattern for existing rows
-- (This assumes raw payloads stay in JSONB for now; future migrations may move to R2)
UPDATE crawled_data
SET normalized_summary = raw_data_blob
WHERE status = 'completed' AND normalized_summary = '{}'::jsonb;

-- ============================================================================
-- ADD TRIGGER FOR UPDATED_AT
-- ============================================================================
-- Apply updated_at trigger to crawled_data
CREATE TRIGGER update_crawled_data_updated_at
  BEFORE UPDATE ON crawled_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION FOR CACHE TTL
-- ============================================================================
-- Function to set cache expiration on insert (default 24h)
CREATE OR REPLACE FUNCTION set_crawled_data_cache_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cache_expires_at IS NULL AND NEW.status = 'completed' THEN
    NEW.cache_expires_at := NEW.crawled_at + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply cache expiration trigger
CREATE TRIGGER set_cache_expires_on_insert
  BEFORE INSERT ON crawled_data
  FOR EACH ROW
  EXECUTE FUNCTION set_crawled_data_cache_expiration();

-- ============================================================================
-- VALIDATION FUNCTION
-- ============================================================================
-- Function to validate sources_used structure
CREATE OR REPLACE FUNCTION validate_sources_used(sources JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  source JSONB;
BEGIN
  -- Empty array is valid
  IF jsonb_array_length(sources) = 0 THEN
    RETURN TRUE;
  END IF;

  -- Check each source object has required fields
  FOR source IN SELECT * FROM jsonb_array_elements(sources)
  LOOP
    IF NOT (
      source ? 'type' AND
      source ? 'timestamp' AND
      source->>'type' IN ('maps', 'website', 'social')
    ) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add validation constraint for sources_used
ALTER TABLE crawled_data
ADD CONSTRAINT crawled_data_sources_valid CHECK (
  validate_sources_used(sources_used)
);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE crawled_data IS 'Cached crawl payloads with multi-source provenance, TTL, and normalized summaries for content agent';
