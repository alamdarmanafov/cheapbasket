import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, hasSupabase } from '@/lib/supabase';
import { PlanId } from '@/data/plans';

WebBrowser.maybeCompleteAuthSession();

export interface Profile {
  display_name: string | null;
  /** Effective plan: 'plus' only while the subscription has not expired. */
  plan: PlanId;
  planExpiresAt: string | null;
  blocked: boolean;
  city: string | null;
}

interface AuthState {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUpEmail: (email: string, password: string, name: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signInEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInApple: () => Promise<{ error?: string }>;
  signInGoogle: () => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** User chose to continue without an account this session. */
  guest: boolean;
  continueAsGuest: () => void;
  /** Last error a provider sent back through the redirect URL (web), for display. */
  lastError: string | null;
}

const Ctx = createContext<AuthState | null>(null);

/** Deep link the OAuth provider returns to: cheapbasket://auth/callback (web: current origin). */
const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Linking.createURL('auth/callback');

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(hasSupabase);
  const [guest, setGuest] = useState(false);
  const [lastError, setLastError] = useState<string | null>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const p = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, ''));
    const d = p.get('error_description') || p.get('error');
    return d ? decodeURIComponent(d.replace(/\+/g, ' ')) : null;
  });

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('display_name, plan, plan_expires_at, blocked, city').eq('user_id', userId).maybeSingle();
    if (!data) {
      setProfile({ display_name: null, plan: 'free', planExpiresAt: null, blocked: false, city: null });
      return;
    }
    const expired = !!data.plan_expires_at && new Date(data.plan_expires_at) <= new Date();
    setProfile({
      display_name: data.display_name,
      plan: data.plan === 'plus' && !expired ? 'plus' : 'free',
      planExpiresAt: data.plan_expires_at,
      blocked: !!data.blocked,
      city: data.city,
    });
    if (data.blocked) await supabase.auth.signOut();
  }, []);

  // Guest choice survives reloads (web) and restarts (native); signing in or out clears it.
  useEffect(() => {
    AsyncStorage.getItem('cb_guest').then((v) => v === '1' && setGuest(true)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user.id).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfile(s?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  /** Finish a PKCE/implicit OAuth round-trip from the URL the browser came back with. */
  const completeFromUrl = async (url: string) => {
    if (!supabase) return;
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    if (typeof code === 'string') {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return;
    }
    const hash = url.split('#')[1];
    if (hash) {
      const p = new URLSearchParams(hash);
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      }
    }
  };

  const oauth = async (provider: 'google' | 'apple') => {
    if (!supabase) return { error: 'Supabase konfiqurasiya olunmayıb' };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
      });
      if (error) throw error;
      if (Platform.OS === 'web') return {}; // browser navigates away; detectSessionInUrl finishes it
      if (!data.url) throw new Error('OAuth URL alınmadı');
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type === 'success') await completeFromUrl(res.url);
      else if (res.type === 'cancel' || res.type === 'dismiss') return { error: 'Giriş ləğv edildi' };
      return {};
    } catch (e) {
      return { error: msg(e) };
    }
  };

  const signInApple = async () => {
    if (!supabase) return { error: 'Supabase konfiqurasiya olunmayıb' };
    // Native Sign in with Apple on iOS; Supabase-hosted OAuth elsewhere.
    if (Platform.OS !== 'ios') return oauth('apple');
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!cred.identityToken) throw new Error('Apple identity token alınmadı');
      const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: rawNonce });
      if (error) throw error;
      // Apple only sends the name on the first sign-in — store it.
      const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
      if (name && data.user) await supabase.from('profiles').upsert({ user_id: data.user.id, display_name: name });
      return {};
    } catch (e) {
      const m = msg(e);
      return m.includes('ERR_REQUEST_CANCELED') ? { error: 'Giriş ləğv edildi' } : { error: m };
    }
  };

  const value = useMemo<AuthState>(
    () => ({
      enabled: hasSupabase,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      async signUpEmail(email, password, name) {
        if (!supabase) return { error: 'Supabase konfiqurasiya olunmayıb' };
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: redirectTo } });
        if (error) return { error: error.message };
        return { needsConfirm: !data.session };
      },
      async signInEmail(email, password) {
        if (!supabase) return { error: 'Supabase konfiqurasiya olunmayıb' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error ? { error: error.message } : {};
      },
      signInApple,
      signInGoogle: () => oauth('google'),
      async resetPassword(email) {
        if (!supabase) return { error: 'Supabase konfiqurasiya olunmayıb' };
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return error ? { error: error.message } : {};
      },
      async signOut() {
        await supabase?.auth.signOut();
        setProfile(null);
        setGuest(false);
        AsyncStorage.removeItem('cb_guest').catch(() => undefined);
      },
      refreshProfile: () => loadProfile(session?.user.id),
      guest,
      continueAsGuest: () => {
        setGuest(true);
        AsyncStorage.setItem('cb_guest', '1').catch(() => undefined);
      },
      lastError,
    }),
    [loading, session, profile, loadProfile, guest, lastError], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
