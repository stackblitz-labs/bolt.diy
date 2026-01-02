/*
  # Fix user profile creation trigger

  1. Function Updates
    - Recreate handle_new_user() function with proper ownership and permissions
    - Set function owner to postgres (superuser) for proper permissions
    - Add SET search_path for security
    - Add error handling with EXCEPTION block

  2. Trigger Updates
    - Ensure trigger is properly configured on auth.users
    - Grant necessary permissions
*/

-- Drop and recreate the function with proper ownership and security settings
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Extract username and display_name from raw_user_meta_data if available
  INSERT INTO public.users (id, email, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, users.username),
    display_name = COALESCE(EXCLUDED.display_name, users.display_name),
    email = COALESCE(EXCLUDED.email, users.email);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth user creation
    RAISE WARNING 'Error creating user profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure function is owned by postgres (superuser) for proper permissions
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Recreate trigger to ensure it's properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

