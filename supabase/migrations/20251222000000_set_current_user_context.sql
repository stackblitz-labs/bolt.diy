-- Create helper RPCs for setting/verifying app.current_user_id
-- This is required because PostgREST RPC cannot call built-in set_config/current_setting directly.

CREATE OR REPLACE FUNCTION set_current_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', TRUE);
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION set_current_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_current_user_id() FROM PUBLIC;

-- Supabase uses a Postgres role named service_role for admin/server operations.
GRANT EXECUTE ON FUNCTION set_current_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_current_user_id() TO service_role;
