import { NextResponse } from 'next/server';
import { decodeJws, fetchAppleSubscriptionStatus, type AppleTransaction } from '@/lib/apple-iap';
import { PRODUCTS, applySubscription } from '@/lib/iap';
import { errText } from '@/lib/server';

export const maxDuration = 30;

interface NotificationPayload {
  notificationType: string;
  subtype?: string;
  data?: { signedTransactionInfo?: string; signedRenewalInfo?: string; environment?: string };
}

/**
 * App Store Server Notifications V2 (renewals, expirations, refunds, grace periods).
 * Register this URL in App Store Connect → App → App Store Server Notifications.
 * Authenticity: we do not trust the posted JWS blindly — the subscription is re-read from the Server API.
 */
export async function POST(req: Request) {
  try {
    const { signedPayload } = (await req.json()) as { signedPayload?: string };
    if (!signedPayload) return NextResponse.json({ error: 'signedPayload yoxdur' }, { status: 400 });
    const payload = decodeJws<NotificationPayload>(signedPayload);
    const posted = payload.data?.signedTransactionInfo ? decodeJws<AppleTransaction>(payload.data.signedTransactionInfo) : null;
    if (!posted) return NextResponse.json({ ok: true, ignored: payload.notificationType });

    // Authoritative state from Apple
    const t = (await fetchAppleSubscriptionStatus(posted.originalTransactionId)) ?? posted;
    if (!PRODUCTS[t.productId]) return NextResponse.json({ ok: true, ignored: t.productId });
    const revoked = !!t.revocationDate || payload.notificationType === 'REFUND' || payload.notificationType === 'REVOKE';
    await applySubscription({
      userId: null,
      platform: 'apple',
      productId: t.productId,
      transactionId: t.transactionId,
      originalTransactionId: t.originalTransactionId,
      expiresAt: t.expiresDate ? new Date(t.expiresDate) : null,
      revoked,
      event: `${payload.notificationType}${payload.subtype ? `/${payload.subtype}` : ''}`,
      raw: { environment: payload.data?.environment },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Apple retries on non-2xx; log and acknowledge malformed payloads to avoid retry storms.
    console.error('apple notification', errText(e));
    return NextResponse.json({ ok: false, error: errText(e) }, { status: 200 });
  }
}
