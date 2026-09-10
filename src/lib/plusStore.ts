import { tr } from './i18n';
import { supabase } from './supabase';

/** App Store / Google Play subscription product ids (must match App Store Connect & Play Console). */
export const PLUS_SKUS = { monthly: 'az.cheapbasket.app.monthly', yearly: 'az.cheapbasket.app.yearly' } as const;
export type PlusPeriod = keyof typeof PLUS_SKUS;
export const PLUS_SKU_LIST: string[] = Object.values(PLUS_SKUS);

/** Base URL of the admin/API deployment (e.g. https://cheapbasket-7ae9.vercel.app). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

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
