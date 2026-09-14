import { Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when env vars are missing — the app then runs on the bundled mock catalog and without accounts. */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          // Persist the session on device; on web supabase-js uses localStorage by default.
          ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
          flowType: 'pkce',
        },
      })
    : null;

export const hasSupabase = supabase != null;

let ensuring: Promise<void> | null = null;

/**
 * A session for the catalogue to read with.
 *
 * The catalogue tables answer only signed-in sessions (0041), so a device
 * that has no account gets an anonymous one, invisibly, on first launch and
 * again after sign-out. A real sign-in later simply replaces it. Concurrent
 * callers share one attempt.
 */
export async function ensureSession(): Promise<void> {
  if (!supabase) return;
  if (ensuring) return ensuring;
  const client = supabase;
  ensuring = (async () => {
    const { data } = await client.auth.getSession();
    if (data.session) return;
    const { error } = await client.auth.signInAnonymously();
    if (error) console.warn('anonymous session:', error.message);
  })().finally(() => {
    ensuring = null;
  });
  return ensuring;
}
