import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tr } from './i18n';
import { supabase } from './supabase';

/** App Store / Google Play subscription product ids (must match App Store Connect & Play Console). */
export const PLUS_SKUS = { monthly: 'az.cheapbasket.app.monthly', yearly: 'az.cheapbasket.app.yearly' } as const;
export type PlusPeriod = keyof typeof PLUS_SKUS;
export const PLUS_SKU_LIST: string[] = Object.values(PLUS_SKUS);

/** Base URL of the admin/API deployment (e.g. https://cheapbasket-7ae9.vercel.app). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * The last prices the store reported, kept so a lock badge on some other
 * screen can say what Plus costs without opening a store connection of its
 * own. The Plus screen refreshes them whenever it loads products; until the
 * store has answered once on this device, there is simply no price to show.
 */
const PRICES_KEY = 'cb_plus_prices';
type Prices = Partial<Record<PlusPeriod, string>>;
let known: Prices = {};
const priceListeners = new Set<(p: Prices) => void>();
export function rememberPlusPrices(p: Prices): void {
  if (!p.monthly && !p.yearly) return;
  known = { ...known, ...p };
  for (const fn of priceListeners) fn(known);
  AsyncStorage.setItem(PRICES_KEY, JSON.stringify(known)).catch(() => undefined);
}
AsyncStorage.getItem(PRICES_KEY)
  .then((raw) => {
    if (!raw) return;
    known = { ...(JSON.parse(raw) as Prices), ...known };
    for (const fn of priceListeners) fn(known);
  })
  .catch(() => undefined);
/** Last known store prices for Plus; empty until the store has answered once. */
export function useKnownPlusPrices(): Prices {
  const [p, setP] = useState<Prices>(known);
  useEffect(() => {
    priceListeners.add(setP);
    setP(known);
    return () => {
      priceListeners.delete(setP);
    };
  }, []);
  return p;
}

export interface PlusStore {
  /** false on web or when the store is not reachable — purchases only work in the native app. */
  available: boolean;
  /** Store connected and products loaded. */
  ready: boolean;
  busy: boolean;
  error: string | null;
  /** Localised store price labels, when the store returned them. */
  prices: Partial<Record<PlusPeriod, string>>;
  buy: (period: PlusPeriod) => Promise<void>;
  restore: () => Promise<void>;
}

export type VerifyBody = { platform: 'apple'; transactionId: string } | { platform: 'google'; productId: string; purchaseToken: string };

/** Ask our server to verify the purchase with Apple/Google and activate Plus on the profile. */
export async function verifyWithServer(body: VerifyBody): Promise<{ active: boolean; expiresAt: number | null }> {
  if (!API_URL) throw new Error(tr('iap.noServer'));
  if (!supabase) throw new Error(tr('common.notConfigured'));
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(tr('iap.signInRequired'));
  // The purchase itself has already gone through by the time this runs, so a
  // dropped connection here means money taken and nothing granted. iOS reports
  // exactly that as "The Internet connection appears to be offline" in the
  // seconds after the payment sheet closes, which is a transient state worth
  // riding out rather than reporting as a failure — the request is idempotent,
  // so repeating it is safe.
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((ok) => setTimeout(ok, attempt * 1500));
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/iap/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch (e) {
      last = e;
      continue;
    }
    const json = (await res.json().catch(() => ({}))) as { active?: boolean; expiresAt?: number | null; error?: string };
    // A refusal from our own server (a bad key, a rejected receipt) is an answer,
    // not a lost connection: repeating it would only produce the same answer.
    if (!res.ok) throw new Error(json.error ?? tr('iap.serverError', { code: res.status }));
    return { active: !!json.active, expiresAt: json.expiresAt ?? null };
  }
  throw last instanceof Error ? last : new Error(String(last));
}
