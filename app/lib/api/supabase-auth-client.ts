import { createClient } from '@supabase/supabase-js';
import { authState } from '~/lib/stores/auth';

/**
 * Custom storage adapter that syncs with authState (bolt_auth localStorage)
 * This allows Supabase client to use the same session storage as the app
 */
function createBoltAuthStorage() {
  const STORAGE_KEY = 'bolt_auth';

  return {
    getItem: (key: string): string | null => {
      try {
        /*
         * Supabase looks for session with a specific key pattern
         * We need to extract the session from bolt_auth
         */
        const boltAuth = localStorage.getItem(STORAGE_KEY);

        if (!boltAuth) {
          return null;
        }

        const auth = JSON.parse(boltAuth);

        // If Supabase is asking for the session, return it in Supabase's expected format
        if (key.includes('auth-token') || key.includes('session')) {
          if (auth.session) {
            /*
             * Supabase expects: { access_token, refresh_token, expires_at, expires_in, token_type, user }
             * We have: { access_token, refresh_token }
             * We need to construct a minimal session object
             */
            const session = {
              access_token: auth.session.access_token,
              refresh_token: auth.session.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + 3600, // Default 1 hour expiry
              expires_in: 3600,
              token_type: 'bearer',
              user: auth.user
                ? {
                    id: auth.user.id,
                    email: auth.user.email,

                    // Add other required user fields if needed
                  }
                : null,
            };

            return JSON.stringify(session);
          }
        }

        return null;
      } catch (error) {
        console.error('Error reading from bolt_auth storage:', error);
        return null;
      }
    },

    setItem: (key: string, value: string): void => {
      try {
        // When Supabase updates the session, sync it back to bolt_auth
        if (key.includes('auth-token') || key.includes('session')) {
          const session = JSON.parse(value);

          // Update authState with the new session
          const currentAuth = authState.get();

          authState.set({
            ...currentAuth,
            session: {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },

            // Update user if provided
            user: session.user
              ? {
                  id: session.user.id,
                  email: session.user.email,
                  username: currentAuth.user?.username || session.user.email?.split('@')[0] || 'user',
                  display_name: currentAuth.user?.display_name || session.user.email?.split('@')[0] || 'User',
                }
              : currentAuth.user,
            isAuthenticated: !!session.access_token,
          });
        }
      } catch (error) {
        console.error('Error writing to bolt_auth storage:', error);
      }
    },

    removeItem: (key: string): void => {
      try {
        // When Supabase removes the session, clear bolt_auth
        if (key.includes('auth-token') || key.includes('session')) {
          authState.set({
            user: null,
            session: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error('Error removing from bolt_auth storage:', error);
      }
    },
  };
}

/**
 * Get Supabase client for bolt.diy authentication (client-side)
 * Uses environment variables for bolt.diy's own Supabase instance
 * Configured to use custom storage that syncs with authState
 */
export function getSupabaseAuthClient() {
  if (typeof window === 'undefined') {
    throw new Error(
      'getSupabaseAuthClient can only be used on the client side. Use getSupabaseAuthClientServer on the server.',
    );
  }

  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Bolt.diy Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
    );
  }

  // Create custom storage adapter
  const customStorage = createBoltAuthStorage();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: customStorage,
      autoRefreshToken: true,
      persistSession: true,
    },
  });
}

/**
 * Get Supabase client on the server side
 * Uses Cloudflare environment or process.env
 * Optionally uses service role key if available (bypasses RLS)
 */
export function getSupabaseAuthClientServer(context?: { cloudflare?: { env?: any } }) {
  const supabaseUrl = context?.cloudflare?.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

  // Try service role key first (bypasses RLS), fallback to anon key
  const supabaseServiceRoleKey =
    context?.cloudflare?.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

  const supabaseAnonKey = context?.cloudflare?.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl) {
    throw new Error('Bolt.diy Supabase URL not configured. Please set VITE_SUPABASE_URL');
  }

  // Use service role key if available (for server-side operations), otherwise use anon key
  const key = supabaseServiceRoleKey || supabaseAnonKey;

  if (!key) {
    throw new Error(
      'Bolt.diy Supabase credentials not configured. Please set VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
