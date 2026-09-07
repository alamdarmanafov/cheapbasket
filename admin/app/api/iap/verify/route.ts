import { NextResponse } from 'next/server';
import { fetchAppleTransaction } from '@/lib/apple-iap';
import { fetchGoogleSubscription } from '@/lib/google-iap';
import { PRODUCTS, applySubscription, userFromToken } from '@/lib/iap';
import { errText } from '@/lib/server';

export const maxDuration = 30;

/**
 * Called by the app right after a purchase or restore. Authenticated with the user's Supabase token.
 * Body: { platform: 'apple', transactionId } | { platform: 'google', productId, purchaseToken }
 */
export async function POST(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
    const body = (await req.json()) as { platform: 'apple' | 'google'; transactionId?: string; productId?: string; purchaseToken?: string };

    if (body.platform === 'apple') {
      if (!body.transactionId) return NextResponse.json({ error: 'transactionId yoxdur' }, { status: 400 });
      const t = await fetchAppleTransaction(body.transactionId);
      if (!PRODUCTS[t.productId]) return NextResponse.json({ error: `Naməlum məhsul: ${t.productId}` }, { status: 400 });
      const r = await applySubscription({
        userId,
        platform: 'apple',
        productId: t.productId,
        transactionId: t.transactionId,
        originalTransactionId: t.originalTransactionId,
        expiresAt: t.expiresDate ? new Date(t.expiresDate) : null,
        revoked: !!t.revocationDate,
        event: 'verify',
        raw: { environment: t.environment },
      });
      return NextResponse.json({ ok: true, active: r.active, expiresAt: t.expiresDate ?? null, environment: t.environment });
    }

    if (body.platform === 'google') {
      if (!body.purchaseToken) return NextResponse.json({ error: 'purchaseToken yoxdur' }, { status: 400 });
      const s = await fetchGoogleSubscription(body.purchaseToken);
      if (!PRODUCTS[s.productId]) return NextResponse.json({ error: `Naməlum məhsul: ${s.productId}` }, { status: 400 });
      const r = await applySubscription({
        userId,
        platform: 'google',
        productId: s.productId,
        transactionId: null,
        purchaseToken: body.purchaseToken,
        expiresAt: s.expiresAt,
        revoked: s.inactive,
        event: 'verify',
        raw: { state: s.state },
      });
      return NextResponse.json({ ok: true, active: r.active, expiresAt: s.expiresAt?.getTime() ?? null });
    }
    return NextResponse.json({ error: 'platform səhvdir' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
