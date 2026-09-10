import { NextResponse } from 'next/server';
import { appleServerToken } from '@/lib/apple-iap';
import { errText, requireAdmin } from '@/lib/server';

/**
 * Is the Apple key we hold actually accepted?
 *
 * Open this while signed in to the admin panel. It signs a token exactly as the
 * verification path does and asks Apple about a transaction id that cannot
 * exist: a 404 is the *good* answer — Apple read our token, then found no such
 * transaction. A 401 or 403 means the key itself is refused, which is the one
 * thing that cannot be told apart by watching a purchase fail on a phone.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });

  const present = {
    APPLE_IAP_KEY_ID: !!process.env.APPLE_IAP_KEY_ID,
    APPLE_IAP_ISSUER_ID: !!process.env.APPLE_IAP_ISSUER_ID,
    APPLE_IAP_PRIVATE_KEY: !!process.env.APPLE_IAP_PRIVATE_KEY,
    APPLE_BUNDLE_ID: process.env.APPLE_BUNDLE_ID || 'az.cheapbasket.app (default)',
  };
  const keyLooksPem = (process.env.APPLE_IAP_PRIVATE_KEY || '').includes('BEGIN PRIVATE KEY');
  // An issuer id is a UUID; a key id is ten characters. Getting these two the
  // wrong way round is a common cause of a refused key.
  const issuerLooksUuid = /^[0-9a-f-]{36}$/i.test((process.env.APPLE_IAP_ISSUER_ID || '').trim());
  const keyIdLooksRight = /^[A-Z0-9]{10}$/i.test((process.env.APPLE_IAP_KEY_ID || '').trim());

  let token = '';
  try {
    token = appleServerToken();
  } catch (e) {
    return NextResponse.json({ ok: false, stage: 'imza', present, keyLooksPem, issuerLooksUuid, keyIdLooksRight, error: errText(e) }, { status: 200 });
  }

  const probe = async (base: string) => {
    const res = await fetch(`${base}/inApps/v1/transactions/0`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: (await res.text().catch(() => '')).slice(0, 200) };
  };

  try {
    const prod = await probe('https://api.storekit.itunes.apple.com');
    const sandbox = await probe('https://api.storekit-sandbox.itunes.apple.com');
    // Each environment is judged on its own. A key that production accepts and
    // sandbox refuses looks fine here while every sandbox purchase fails, which
    // is exactly the case that is hard to see from the phone.
    const ok = (s: number) => s !== 401 && s !== 403;
    const accepted = ok(prod.status) && ok(sandbox.status);
    return NextResponse.json({
      ok: accepted,
      verdict: accepted
        ? 'Açar hər iki mühitdə qəbul edilir (404 = Apple tokeni oxudu, sadəcə belə tranzaksiya yoxdur — gözlənilən cavab).'
        : !ok(prod.status) && !ok(sandbox.status)
          ? 'Açar RƏDD edilir (401/403). Açar "In-App Purchase" tipində olmalıdır: App Store Connect → Users and Access → Integrations → In-App Purchase.'
          : ok(prod.status)
            ? 'Production qəbul edir, SANDBOX rədd edir — sandbox alışları təsdiqlənə bilməyəcək.'
            : 'Sandbox qəbul edir, PRODUCTION rədd edir — real alışlar təsdiqlənə bilməyəcək.',
      present,
      keyLooksPem,
      issuerLooksUuid,
      keyIdLooksRight,
      prod,
      sandbox,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, stage: 'sorğu', present, error: errText(e) }, { status: 200 });
  }
}
