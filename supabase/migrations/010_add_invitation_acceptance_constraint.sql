/*
  # Add constraint to ensure users are only members after accepting invitations

  1. Purpose:
    - Ensure data integrity: users should only be in workspace_members if they've accepted an invitation
    - Add a function to check if a user has an accepted invitation before being a member
    - This is a safeguard to prevent accidental or manual additions

  2. Note:
    - This doesn't prevent manual database inserts, but documents the expected flow
    - The application logic should always check invitation status before adding members
*/

-- Function to check if user has accepted invitation for a workspace
CREATE OR REPLACE FUNCTION user_has_accepted_invitation(p_user_id uuid, p_workspace_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM workspace_invitations 
    WHERE workspace_id = p_workspace_id 
      AND email = (SELECT email FROM users WHERE id = p_user_id)
      AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql;

-- Add a comment to workspace_members table documenting the expected flow
COMMENT ON TABLE workspace_members IS 
  'Users should only be added to this table after accepting a workspace invitation. 
   The invitation status should be updated to "accepted" when a user is added.';

-- Add a comment to workspace_invitations table
COMMENT ON TABLE workspace_invitations IS 
  'Invitations must be accepted before users are added to workspace_members. 
   Users should only be added to workspace_members when status changes to "accepted".';

