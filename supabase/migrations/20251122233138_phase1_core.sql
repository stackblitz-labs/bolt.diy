-- Phase 1 Core Schema Migration
-- Creates tables for business profiles, crawled data, and site snapshots
-- Based on specs/001-phase1-plan/data-model.md

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
-- Represents a single restaurant/customer operating inside HuskIT
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for status queries
CREATE INDEX idx_tenants_status ON tenants(status);

-- ============================================================================
-- BUSINESS_PROFILES TABLE
-- ============================================================================
-- Canonical, AI-enhanced representation of a tenant's brand, menu, and design system
CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  google_place_id VARCHAR(255),
  gmaps_url TEXT NOT NULL,
  logo_url TEXT,

  -- Structured JSON fields
  contact_info JSONB DEFAULT '{}' CHECK (
    jsonb_typeof(contact_info) = 'object'
  ),
  address JSONB DEFAULT '{}' CHECK (
    jsonb_typeof(address) = 'object'
  ),
  hours_of_operation JSONB DEFAULT '[]' CHECK (
    jsonb_typeof(hours_of_operation) = 'array'
  ),
  ai_generated_copy JSONB NOT NULL DEFAULT '{}' CHECK (
    jsonb_typeof(ai_generated_copy) = 'object'
  ),
  ai_extracted_themes JSONB DEFAULT '{}' CHECK (
    jsonb_typeof(ai_extracted_themes) = 'object'
  ),
  menu JSONB DEFAULT '[]' CHECK (
    jsonb_typeof(menu) = 'array'
  ),
  gallery_images JSONB DEFAULT '[]' CHECK (
    jsonb_typeof(gallery_images) = 'array' AND
    jsonb_array_length(gallery_images) <= 20
  ),
  testimonials JSONB DEFAULT '[]' CHECK (
    jsonb_typeof(testimonials) = 'array' AND
    jsonb_array_length(testimonials) <= 50
  ),
  design_system JSONB DEFAULT '{}' CHECK (
    jsonb_typeof(design_system) = 'object'
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_business_profiles_tenant_id ON business_profiles(tenant_id);
CREATE INDEX idx_business_profiles_google_place_id ON business_profiles(google_place_id) WHERE google_place_id IS NOT NULL;

-- ============================================================================
-- CRAWLED_DATA TABLE
-- ============================================================================
-- Cached raw payloads fetched from Google Places or supplied URLs
CREATE TABLE IF NOT EXISTS crawled_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  raw_data_blob JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint to ensure raw_data_blob is not too large (approximate 2MB limit)
  CONSTRAINT raw_data_size_limit CHECK (
    pg_column_size(raw_data_blob) <= 2097152
  )
);

-- Indexes
CREATE INDEX idx_crawled_data_tenant_id ON crawled_data(tenant_id);
CREATE INDEX idx_crawled_data_status ON crawled_data(status);
CREATE INDEX idx_crawled_data_source_url ON crawled_data(source_url);

-- ============================================================================
-- SITE_SNAPSHOTS TABLE
-- ============================================================================
-- Versioned archive of a generated site plus metadata for restoration
CREATE TABLE IF NOT EXISTS site_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_profile_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  template_id VARCHAR(255) NOT NULL,
  workspace_archive_url TEXT NOT NULL,
  version_label VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_site_snapshots_tenant_id ON site_snapshots(tenant_id);
CREATE INDEX idx_site_snapshots_business_profile_id ON site_snapshots(business_profile_id);
CREATE INDEX idx_site_snapshots_template_id ON site_snapshots(template_id);
CREATE INDEX idx_site_snapshots_created_at ON site_snapshots(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================
-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tenants
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to business_profiles
DROP TRIGGER IF EXISTS update_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER update_business_profiles_updated_at
    BEFORE UPDATE ON business_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_snapshots ENABLE ROW LEVEL SECURITY;

-- Tenants: Users can only access their own tenant
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Business Profiles: Users can only access profiles for their tenant
CREATE POLICY business_profiles_isolation_policy ON business_profiles
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Crawled Data: Users can only access crawled data for their tenant
CREATE POLICY crawled_data_isolation_policy ON crawled_data
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Site Snapshots: Users can only access snapshots for their tenant
CREATE POLICY site_snapshots_isolation_policy ON site_snapshots
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Function to set the current tenant context
CREATE OR REPLACE FUNCTION set_current_tenant(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', tenant_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get the current tenant context
CREATE OR REPLACE FUNCTION get_current_tenant()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_tenant_id', TRUE)::UUID;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE tenants IS 'Restaurant/customer accounts operating within HuskIT';
COMMENT ON TABLE business_profiles IS 'AI-enhanced brand representation with menu, design system, and content';
COMMENT ON TABLE crawled_data IS 'Cached raw payloads from Google Places and other sources';
COMMENT ON TABLE site_snapshots IS 'Versioned website archives with metadata for restoration';

COMMENT ON COLUMN tenants.status IS 'Tenant lifecycle state: active, suspended, or archived';
COMMENT ON COLUMN business_profiles.ai_generated_copy IS 'Structured copy for hero, about, CTA, testimonials intro';
COMMENT ON COLUMN business_profiles.design_system IS 'Color palette, fonts, and design tokens';
COMMENT ON COLUMN crawled_data.status IS 'Crawl status for retry logic: pending, completed, failed';
COMMENT ON COLUMN site_snapshots.workspace_archive_url IS 'HTTPS link to R2/S3 archive object';
