import crypto from 'node:crypto';

/**
 * Google Play Developer API client for subscription verification.
 * Env: GOOGLE_PLAY_SERVICE_ACCOUNT (the service-account JSON, one line), GOOGLE_PLAY_PACKAGE.
 * The service account needs "View financial data" + "Manage orders and subscriptions" in Play Console → Users and permissions.
 */
const PACKAGE = process.env.GOOGLE_PLAY_PACKAGE || 'az.cheapbasket.app';
const b64u = (b: Buffer | string) => Buffer.from(b).toString('base64url');

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;
  if (!raw) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT təyin edilməyib');
  const sa = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!sa.client_email || !sa.private_key) throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT JSON-u natamamdır');
  return { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, '\n') };
}

let cached: { token: string; exp: number } | null = null;

/** OAuth2 access token via the service-account JWT grant. */
async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), crypto.createPrivateKey(sa.private_key));
  const assertion = `${header}.${payload}.${b64u(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google token: ${json.error_description ?? res.status}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

export interface GoogleSubscription {
  productId: string;
  expiresAt: Date | null;
  state: string;
  /** true when the purchase is pending payment, revoked or expired */
  inactive: boolean;
  linkedPurchaseToken: string | null;
}

/** purchases.subscriptionsv2.get — authoritative subscription state for a purchase token. */
export async function fetchGoogleSubscription(purchaseToken: string): Promise<GoogleSubscription> {
  const token = await accessToken();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as {
    subscriptionState?: string;
    linkedPurchaseToken?: string;
    lineItems?: Array<{ productId: string; expiryTime?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Google Play: ${json.error?.message ?? res.status}`);
  const item = (json.lineItems ?? []).sort((a, b) => (b.expiryTime ?? '').localeCompare(a.expiryTime ?? ''))[0];
  if (!item) throw new Error('Google Play: abunəlik məlumatı boşdur');
  const state = json.subscriptionState ?? 'UNKNOWN';
  return {
    productId: item.productId,
    expiresAt: item.expiryTime ? new Date(item.expiryTime) : null,
    state,
    inactive: ['SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PAUSED'].includes(state),
    linkedPurchaseToken: json.linkedPurchaseToken ?? null,
  };
}
