-- Add business_profile column to projects table
-- This stores the full crawler payload (BusinessProfile) as JSONB
-- Feature: 001-crawler-api-integration

-- Add the business_profile column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'projects'
    AND column_name = 'business_profile'
  ) THEN
    ALTER TABLE projects ADD COLUMN business_profile JSONB;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN projects.business_profile IS 'Crawler data and AI-generated content from Google Maps integration (BusinessProfile JSONB)';

-- Create index for JSONB queries on session_id (commonly queried field)
CREATE INDEX IF NOT EXISTS idx_projects_business_profile_session_id 
  ON projects USING gin ((business_profile -> 'session_id'));

-- Create index for gmaps_url lookups
CREATE INDEX IF NOT EXISTS idx_projects_business_profile_gmaps_url 
  ON projects USING gin ((business_profile -> 'gmaps_url'));

