/*
  # Fix infinite recursion in workspaces RLS policies

  1. Problem
    - The workspaces policy queries workspace_members
    - The workspace_members policy queries workspaces
    - This creates infinite recursion

  2. Solution
    - Create a security definer function to check workspace access
    - Update all policies to use this function instead of direct queries
    - This breaks the circular dependency
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Workspace members can read workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace members can read members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members can read chats" ON chats;
DROP POLICY IF EXISTS "Workspace members can create chats" ON chats;
DROP POLICY IF EXISTS "Workspace members can update chats" ON chats;
DROP POLICY IF EXISTS "Workspace members can delete chats" ON chats;

-- Create a security definer function to check if user has access to workspace
-- This function bypasses RLS and can check both ownership and membership
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if user is owner
  IF EXISTS (SELECT 1 FROM workspaces WHERE id = workspace_uuid AND owner_id = user_uuid) THEN
    RETURN true;
  END IF;

  -- Check if user is a member (direct query without RLS recursion)
  IF EXISTS (
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = workspace_uuid AND user_id = user_uuid
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_has_workspace_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_workspace_access(uuid, uuid) TO anon;

-- Recreate workspaces read policy using the function (avoids recursion)
CREATE POLICY "Workspace members can read workspaces"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(id, auth.uid()));

-- Recreate workspace_members read policy using the function (avoids recursion)
CREATE POLICY "Workspace members can read members"
  ON workspace_members
  FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id, auth.uid()));

-- Recreate chats policies using the function (avoids recursion)
CREATE POLICY "Workspace members can read chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create chats"
  ON chats
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_has_workspace_access(workspace_id, auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Workspace members can update chats"
  ON chats
  FOR UPDATE
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete chats"
  ON chats
  FOR DELETE
  TO authenticated
  USING (public.user_has_workspace_access(workspace_id, auth.uid()));
