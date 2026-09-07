import { NextResponse } from 'next/server';
import { fetchGoogleSubscription } from '@/lib/google-iap';
import { PRODUCTS, applySubscription } from '@/lib/iap';
import { errText } from '@/lib/server';

export const maxDuration = 30;

interface Rtdn {
  version?: string;
  packageName?: string;
  subscriptionNotification?: { notificationType: number; purchaseToken: string; subscriptionId?: string };
  testNotification?: { version: string };
}

/**
 * Google Play Real-time developer notifications (Pub/Sub push subscription → this URL).
 * Play Console → Monetise → Monetisation setup → Real-time developer notifications.
 * The purchase token is re-read from the Play Developer API, so the posted body is never trusted directly.
 */
export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message?: { data?: string } };
    if (!message?.data) return NextResponse.json({ error: 'message.data yoxdur' }, { status: 400 });
    const rtdn = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8')) as Rtdn;
    if (rtdn.testNotification || !rtdn.subscriptionNotification) return NextResponse.json({ ok: true, ignored: true });

    const { purchaseToken, notificationType } = rtdn.subscriptionNotification;
    const s = await fetchGoogleSubscription(purchaseToken);
    if (!PRODUCTS[s.productId]) return NextResponse.json({ ok: true, ignored: s.productId });
    await applySubscription({
      userId: null,
      platform: 'google',
      productId: s.productId,
      transactionId: null,
      purchaseToken,
      expiresAt: s.expiresAt,
      revoked: s.inactive,
      event: `google/${notificationType}/${s.state}`,
      raw: { linkedPurchaseToken: s.linkedPurchaseToken },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Always 200 so Pub/Sub does not retry forever; the error is logged for Vercel.
    console.error('google rtdn', errText(e));
    return NextResponse.json({ ok: false, error: errText(e) });
  }
}
