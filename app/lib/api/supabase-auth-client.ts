import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client for bolt.diy authentication (client-side)
 * Uses environment variables for bolt.diy's own Supabase instance
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

  return createClient(supabaseUrl, supabaseAnonKey);
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
