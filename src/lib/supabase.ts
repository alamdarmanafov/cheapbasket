import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when env vars are missing — the app then runs on the bundled mock catalog. */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export const hasSupabase = supabase != null;
