-- ============================================================================
-- BETTER AUTH USER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT FALSE,
  image TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_tenant_id ON "user"(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- BETTER AUTH SESSION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS session (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session(expires_at);

-- ============================================================================
-- BETTER AUTH ACCOUNT TABLE (OAuth Providers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS account (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  provider_id VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  id_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider ON account(provider_id, provider_account_id);

-- Reset verification table during development to ensure correct column types
DROP TABLE IF EXISTS verification CASCADE;

CREATE TABLE verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_updated_at
  BEFORE UPDATE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_updated_at
  BEFORE UPDATE ON session
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_updated_at
  BEFORE UPDATE ON account
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE session ENABLE ROW LEVEL SECURITY;
ALTER TABLE account ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user' AND policyname = 'user_self_access'
  ) THEN
    CREATE POLICY user_self_access ON "user"
      FOR SELECT
      USING (id = current_setting('app.current_user_id', TRUE)::UUID);
  END IF;
END $$;

-- Service role bypass for auth operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user' AND policyname = 'user_service_role'
  ) THEN
    CREATE POLICY user_service_role ON "user"
      FOR ALL
      USING (current_setting('role', TRUE) = 'service_role');
  END IF;
END $$;

-- Sessions: user can view own sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session' AND policyname = 'session_user_access'
  ) THEN
    CREATE POLICY session_user_access ON session
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);
  END IF;
END $$;

-- Service role can manage all sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'session' AND policyname = 'session_service_role'
  ) THEN
    CREATE POLICY session_service_role ON session
      FOR ALL
      USING (current_setting('role', TRUE) = 'service_role');
  END IF;
END $$;

-- Accounts: user can view own accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'account' AND policyname = 'account_user_access'
  ) THEN
    CREATE POLICY account_user_access ON account
      FOR SELECT
      USING (user_id = current_setting('app.current_user_id', TRUE)::UUID);
  END IF;
END $$;

-- Service role can manage all accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'account' AND policyname = 'account_service_role'
  ) THEN
    CREATE POLICY account_service_role ON account
      FOR ALL
      USING (current_setting('role', TRUE) = 'service_role');
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE "user" IS 'Better Auth user accounts with tenant linkage';
COMMENT ON TABLE session IS 'Server-side session storage for Better Auth';
COMMENT ON TABLE account IS 'OAuth provider account linkages';
COMMENT ON TABLE verification IS 'Email/phone verification tokens';

