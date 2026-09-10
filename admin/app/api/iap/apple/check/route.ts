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
  // The two identifiers, so they can be read off against App Store Connect
  // without anyone digging through Vercel. Neither is a credential on its own —
  // the key id is literally the .p8 filename — and the page is behind the admin
  // cookie; the private key itself is never returned in any form.
  const keyId = (process.env.APPLE_IAP_KEY_ID || '').trim();
  const issuer = (process.env.APPLE_IAP_ISSUER_ID || '').trim();
  const values = {
    keyId,
    // In-app purchase keys download as SubscriptionKey_<KEYID>.p8; the
    // AuthKey_ prefix belongs to App Store Connect API keys. Either way the ten
    // characters in the name are the key id, so the name below must match the
    // file that was pasted into APPLE_IAP_PRIVATE_KEY.
    keyIdFileName: keyId ? `SubscriptionKey_${keyId}.p8 (və ya AuthKey_${keyId}.p8)` : '',
    issuerId: issuer.length > 12 ? `${issuer.slice(0, 8)}…${issuer.slice(-4)}` : issuer,
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
    return NextResponse.json({ ok: false, stage: 'imza', present, values, keyLooksPem, issuerLooksUuid, keyIdLooksRight, error: errText(e) }, { status: 200 });
  }

  const probe = async (base: string) => {
    const res = await fetch(`${base}/inApps/v1/transactions/0`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: (await res.text().catch(() => '')).slice(0, 200) };
  };

  // The same key, tried against the App Store Connect API. That service accepts
  // team keys; the App Store Server API accepts only in-app-purchase keys. The
  // two look identical in every way this page can inspect — same shape of id,
  // same issuer format, same .p8 — so the only way to tell them apart is to ask
  // each service which one it recognises.
  const probeConnect = async () => {
    try {
      const t = appleServerToken({ bundleId: false });
      const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', { headers: { Authorization: `Bearer ${t}` } });
      return { status: res.status };
    } catch (e) {
      return { status: 0, error: errText(e) };
    }
  };

  try {
    const prod = await probe('https://api.storekit.itunes.apple.com');
    const sandbox = await probe('https://api.storekit-sandbox.itunes.apple.com');
    const connect = await probeConnect();
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
      values,
      keyLooksPem,
      issuerLooksUuid,
      keyIdLooksRight,
      prod,
      sandbox,
      connect,
      // The diagnosis has to follow the same per-environment reading as the
      // verdict. It used to describe "both refused" whenever the pair was not
      // perfect, so a key that sandbox had started accepting was still reported
      // as broken — the two lines contradicted each other.
      diagnosis:
        ok(prod.status) && ok(sandbox.status)
          ? undefined
          : !ok(prod.status) && !ok(sandbox.status)
            ? connect.status === 200
              ? 'Bu açar App Store Connect API-də işləyir, yəni "Team key"dir. Ödəniş yoxlaması üçün AYRI açar lazımdır: Users and Access → Integrations → In-App Purchase → yeni açar. Issuer ID-ni də həmin səhifədən götür.'
              : 'Açar hər iki servisdə rədd edilir, yəni üçlük bir-birinə uyğun deyil: ya Issuer ID başqa səhifədəndir, ya KEY_ID bu .p8 faylına aid deyil, ya da açar ləğv edilib (revoked).'
            : ok(sandbox.status)
              ? 'Sandbox açarı qəbul edir — sandbox alışları təsdiqlənəcək, test edə bilərsən. Production hələ rədd edir; tətbiq App Store-da yayımlanandan sonra bunu yenidən yoxla, çünki real alışlar production üzərindən təsdiqlənir.'
              : 'Production qəbul edir, sandbox rədd edir — sandbox testləri təsdiqlənməyəcək.',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, stage: 'sorğu', present, values, error: errText(e) }, { status: 200 });
  }
}
