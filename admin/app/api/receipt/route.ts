import { NextResponse } from 'next/server';
import { guessStore, matchReceipt, readReceipt } from '@/lib/receipt';
import { userFromToken } from '@/lib/iap';
import { adminDb, errText } from '@/lib/server';

export const maxDuration = 60;

const bakuDayStart = () => {
  const now = new Date(Date.now() + 4 * 3600 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  return new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
};

/**
 * POST { image } → the receipt read and matched, for the shopper to confirm.
 * A few a day for everyone: a receipt is worth more to us than a product
 * photo, so it is not a Plus feature, but a vision call costs money and
 * points make it worth flooding.
 */
export async function POST(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur', code: 'auth' }, { status: 401 });
    const db = adminDb();
    const { data: setting } = await db.from('app_settings').select('value').eq('key', 'receipts').maybeSingle();
    const perDay = Number((setting?.value as { free_per_day?: number } | null)?.free_per_day ?? 3);
    const { count } = await db.from('ai_usage').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'receipt').gte('created_at', bakuDayStart());
    if ((count ?? 0) >= perDay) return NextResponse.json({ error: `Gündə ${perDay} çek. Sabah davam et.`, code: 'limit' }, { status: 429 });

    const { image } = (await req.json()) as { image?: string };
    if (!image) return NextResponse.json({ error: 'Şəkil yoxdur' }, { status: 400 });
    if (image.length > 4_000_000) return NextResponse.json({ error: 'Şəkil çox böyükdür' }, { status: 413 });

    await db.from('ai_usage').insert({ user_id: userId, kind: 'receipt' });
    const read = await readReceipt(image);
    const [items, store_id] = await Promise.all([matchReceipt(read.items), guessStore(read.store)]);
    return NextResponse.json({ store_id, store_name: read.store, total: read.total, items, remaining: perDay - (count ?? 0) - 1 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** PUT { store_id, total, items } → queued for the admin; the trip is written now, the points on approval. */
export async function PUT(req: Request) {
  try {
    const userId = await userFromToken(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Giriş tələb olunur', code: 'auth' }, { status: 401 });
    const body = (await req.json()) as { store_id?: string | null; total?: number | null; items?: Array<{ product_id?: string | null; name?: string; price?: number; qty?: number }> };
    const items = (body.items ?? [])
      .map((it) => ({ product_id: it.product_id || null, name: String(it.name ?? '').slice(0, 120), price: Math.round(Number(it.price) * 100) / 100, qty: Math.max(1, Math.round(Number(it.qty) || 1)) }))
      .filter((it) => it.name && Number.isFinite(it.price) && it.price > 0)
      .slice(0, 80);
    if (!items.length) return NextResponse.json({ error: 'Çekdə məhsul yoxdur' }, { status: 400 });
    const db = adminDb();
    const total = body.total != null && Number.isFinite(Number(body.total)) ? Number(body.total) : items.reduce((a, it) => a + it.price * it.qty, 0);
    const { data, error } = await db.from('receipts').insert({ user_id: userId, store_id: body.store_id || null, total, items }).select('id').single();
    if (error) throw error;
    if (body.store_id) await db.from('trips').insert({ user_id: userId, store_id: body.store_id, branch_id: null, total, saving: 0, items: items.length }).then(() => undefined, () => undefined);
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
