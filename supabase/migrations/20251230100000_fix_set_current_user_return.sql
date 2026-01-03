-- Fix: Update set_current_user to return the value for atomic verification
-- This prevents race conditions with PgBouncer connection pooling where
-- set_current_user and get_current_user_id might execute on different connections.

-- Drop and recreate with new return type
DROP FUNCTION IF EXISTS set_current_user(UUID);

CREATE OR REPLACE FUNCTION set_current_user(user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Use TRUE (local/transaction-scoped) which is more appropriate for connection pooling
  -- and return the value immediately for atomic verification
  PERFORM set_config('app.current_user_id', user_id::TEXT, TRUE);
  RETURN current_setting('app.current_user_id', TRUE);
END;
$$ LANGUAGE plpgsql;

-- Restore permissions
REVOKE ALL ON FUNCTION set_current_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_current_user(UUID) TO service_role;

-- Add comment explaining the pattern
COMMENT ON FUNCTION set_current_user(UUID) IS 
'Sets app.current_user_id for RLS policies and returns the value for verification.
Returns the set value to enable atomic set+verify in a single call, 
preventing race conditions with PgBouncer connection pooling.';

