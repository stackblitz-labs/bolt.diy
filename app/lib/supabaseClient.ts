import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let lastUrl: string | null = null;
let lastAnonKey: string | null = null;

export function getSupabaseClient(supabaseUrl: string, supabaseAnonKey: string): SupabaseClient {
  if (!supabase || lastUrl !== supabaseUrl || lastAnonKey !== supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    lastUrl = supabaseUrl;
    lastAnonKey = supabaseAnonKey;
  }
  return supabase;
}
