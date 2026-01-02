/*
  # Add user profile insert policy and automatic profile creation trigger

  1. Security
    - Add INSERT policy for users to create their own profile
    - This allows authenticated users to insert their profile during signup

  2. Automation
    - Create function to automatically create user profile when auth user is created
    - Create trigger on auth.users to call this function
    - This ensures user profiles are always created, even if the application code fails
*/

-- Add INSERT policy for users to create their own profile
-- Drop if exists to handle cases where it might have been added manually
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Function to handle new user creation
-- Uses SECURITY DEFINER to bypass RLS and create the profile
-- Must be owned by postgres (or service_role) to have proper permissions
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

-- Trigger to automatically create user profile when auth user is created
-- Must be created in the auth schema
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

