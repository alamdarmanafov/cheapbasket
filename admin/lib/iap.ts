import { adminDb } from './server';

/** Store product id → plan. Extend when more products are added. */
export const PRODUCTS: Record<string, { plan: 'plus'; period: 'monthly' | 'yearly' }> = {
  'az.cheapbasket.app.monthly': { plan: 'plus', period: 'monthly' },
  'az.cheapbasket.app.yearly': { plan: 'plus', period: 'yearly' },
  plus_monthly: { plan: 'plus', period: 'monthly' },
  plus_yearly: { plan: 'plus', period: 'yearly' },
};

/** Apply a verified store subscription state to the user's profile. */
export async function applySubscription(input: {
  userId: string | null;
  platform: 'apple' | 'google';
  productId: string;
  transactionId: string | null;
  originalTransactionId?: string | null;
  purchaseToken?: string | null;
  expiresAt: Date | null;
  revoked?: boolean;
  event: string;
  raw?: unknown;
}) {
  const db = adminDb();
  const active = !input.revoked && !!input.expiresAt && input.expiresAt > new Date();

  // Find the profile by user id, or by the store identifiers (renewal notifications carry no user id).
  let userId = input.userId;
  if (!userId) {
    const q = input.platform === 'apple' ? db.from('profiles').select('user_id').eq('apple_original_transaction_id', input.originalTransactionId ?? '') : db.from('profiles').select('user_id').eq('google_purchase_token', input.purchaseToken ?? '');
    const { data } = await q.maybeSingle();
    userId = data?.user_id ?? null;
  }

  await db.from('iap_events').insert({ user_id: userId, platform: input.platform, event: input.event, product_id: input.productId, transaction_id: input.transactionId, expires_at: input.expiresAt?.toISOString() ?? null, raw: input.raw ?? null });
  if (!userId) return { userId: null, active };

  const patch: Record<string, unknown> = {
    user_id: userId,
    plan: active ? 'plus' : 'free',
    plan_expires_at: input.expiresAt?.toISOString() ?? null,
    plan_source: input.platform,
    plan_product_id: input.productId,
    updated_at: new Date().toISOString(),
  };
  if (input.platform === 'apple' && input.originalTransactionId) patch.apple_original_transaction_id = input.originalTransactionId;
  if (input.platform === 'google' && input.purchaseToken) patch.google_purchase_token = input.purchaseToken;
  const { error } = await db.from('profiles').upsert(patch);
  if (error) throw error;
  return { userId, active };
}

/** Resolve the Supabase user from the app's access token. */
export async function userFromToken(auth: string | null): Promise<string | null> {
  const token = (auth ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await adminDb().auth.getUser(token);
  return data.user?.id ?? null;
}
