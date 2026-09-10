import crypto from 'node:crypto';

/**
 * Apple App Store Server API client (StoreKit 2).
 * Env: APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY (.p8 contents), APPLE_BUNDLE_ID.
 */
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'az.cheapbasket.app';
const PROD = 'https://api.storekit.itunes.apple.com';
const SANDBOX = 'https://api.storekit-sandbox.itunes.apple.com';

const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Short-lived JWT for the App Store Server API (ES256, signed with the In-App Purchase key). */
export function appleServerToken(): string {
  const kid = process.env.APPLE_IAP_KEY_ID;
  const iss = process.env.APPLE_IAP_ISSUER_ID;
  const pem = (process.env.APPLE_IAP_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!kid || !iss || !pem) throw new Error('APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID / APPLE_IAP_PRIVATE_KEY təyin edilməyib');
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'ES256', kid, typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ iss, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1', bid: BUNDLE_ID }));
  const key = crypto.createPrivateKey(pem);
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64u(sig)}`;
}

/** Decode the payload of an Apple JWS (signature is Apple's; we authenticate by fetching through the Server API). */
export function decodeJws<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('JWS formatı səhvdir');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as T;
}

export interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  environment: 'Sandbox' | 'Production';
  revocationDate?: number;
  type?: string;
  appAccountToken?: string;
}

/** GET /inApps/v1/transactions/{id} — tries production, then sandbox (Apple returns 404 for sandbox txns on prod). */
export async function fetchAppleTransaction(transactionId: string): Promise<AppleTransaction> {
  const token = appleServerToken();
  let last = '';
  for (const base of [PROD, SANDBOX]) {
    const res = await fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const j = (await res.json()) as { signedTransactionInfo: string };
      return decodeJws<AppleTransaction>(j.signedTransactionInfo);
    }
    last = `${res.status} ${await res.text().catch(() => '')}`.slice(0, 200);
    // 401/403 is our own credentials being refused, not a missing transaction.
    // Reporting it as "not found" sent everyone looking in App Store Connect for
    // a purchase that had in fact gone through.
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Apple açarı qəbul edilmədi (${res.status}). APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID / APPLE_IAP_PRIVATE_KEY yoxlanmalıdır — açar "In-App Purchase" tipində olmalıdır.`,
      );
    }
    if (res.status !== 404) break;
  }
  throw new Error(`Apple: tranzaksiya tapılmadı (${last})`);
}

/** Latest transaction of a subscription (by original transaction id) — used for renewals and restore. */
export async function fetchAppleSubscriptionStatus(originalTransactionId: string): Promise<AppleTransaction | null> {
  const token = appleServerToken();
  for (const base of [PROD, SANDBOX]) {
    const res = await fetch(`${base}/inApps/v1/subscriptions/${encodeURIComponent(originalTransactionId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      if (res.status === 404) continue;
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Apple açarı qəbul edilmədi (${res.status}). APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID / APPLE_IAP_PRIVATE_KEY yoxlanmalıdır.`);
      }
      throw new Error(`Apple ${res.status}`);
    }
    const j = (await res.json()) as { data?: Array<{ lastTransactions?: Array<{ signedTransactionInfo: string }> }> };
    const jws = j.data?.[0]?.lastTransactions?.[0]?.signedTransactionInfo;
    return jws ? decodeJws<AppleTransaction>(jws) : null;
  }
  return null;
}
