import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { Candidate, feedItems, rank } from '@/lib/find';
import { normalizeGtin } from '@/lib/gtin';

export const maxDuration = 60;

interface StoreResult { store_id: string; store_name: string; have: number | null; sources: number; candidates: Candidate[]; linked: string | null; error?: string }

/**
 * POST { product_id, store_id } → that store's closest feed items and prices.
 *
 * One store per request, its sources one after another: a whole feed is a
 * large JSON, and fetching every store's at once in a single function call
 * was how the call died at the platform's time and memory limits with an
 * HTML error page instead of an answer. The page asks store by store.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { product_id, store_id } = (await req.json()) as { product_id: string; store_id: string };
    if (!product_id || !store_id) return NextResponse.json({ error: 'product_id və store_id lazımdır' }, { status: 400 });
    const db = adminDb();
    const [{ data: product }, { data: store }, { data: sources }, { data: price }, { data: link }] = await Promise.all([
      db.from('products').select('id, brand, name, size, barcode').eq('id', product_id).maybeSingle(),
      db.from('stores').select('id, name').eq('id', store_id).maybeSingle(),
      db.from('import_sources').select('url').eq('store_id', store_id).eq('enabled', true),
      db.from('prices').select('price').eq('product_id', product_id).eq('store_id', store_id).maybeSingle(),
      db.from('product_links').select('ext_id').eq('product_id', product_id).eq('store_id', store_id).maybeSingle(),
    ]);
    if (!product) return NextResponse.json({ error: 'Məhsul tapılmadı' }, { status: 404 });
    if (!store) return NextResponse.json({ error: 'Market tapılmadı' }, { status: 404 });
    const urls = (sources ?? []).map((x) => x.url as string);
    const result: StoreResult = { store_id: store.id, store_name: store.name, have: price ? Number(price.price) : null, sources: urls.length, candidates: [], linked: link?.ext_id ?? null };
    const seen = new Map<string, Candidate>();
    const errors: string[] = [];
    for (const u of urls) {
      try {
        const { items } = await feedItems(u);
        for (const c of rank(product, items, 5)) if (!seen.has(c.ext_id) || (seen.get(c.ext_id)?.score ?? 0) < c.score) seen.set(c.ext_id, c);
      } catch (e) { errors.push(errText(e)); }
    }
    result.candidates = [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 3);
    if (errors.length && !seen.size) result.error = errors[0];
    return NextResponse.json({ product, result });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** PUT { product_id, store_id, ext_id, price, regular_price?, barcode? } → the link, the price, and a barcode we lacked. */
export async function PUT(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const b = (await req.json()) as { product_id: string; store_id: string; ext_id: string; price: number; regular_price?: number | null; barcode?: string | null };
    if (!b.product_id || !b.store_id || !b.ext_id || !(Number(b.price) > 0)) return NextResponse.json({ error: 'Məlumat natamamdır' }, { status: 400 });
    const db = adminDb();
    const now = new Date().toISOString();
    const { error: e1 } = await db.from('product_links').upsert({ store_id: b.store_id, ext_id: b.ext_id, product_id: b.product_id }, { onConflict: 'store_id,ext_id' });
    if (e1) throw e1;
    const regular = b.regular_price != null && Number(b.regular_price) > Number(b.price) ? Number(b.regular_price) : null;
    const row: { product_id: string; store_id: string; price: number; discount_price: number | null; updated_at: string } = {
      product_id: b.product_id, store_id: b.store_id,
      price: regular ?? Number(b.price), discount_price: regular ? Number(b.price) : null, updated_at: now,
    };
    const { error: e2 } = await db.from('prices').upsert(row, { onConflict: 'product_id,store_id' });
    if (e2) throw e2;
    await db.from('price_history').insert({ ...row, recorded_at: now }).then(() => undefined, () => undefined);
    const bc = normalizeGtin(b.barcode);
    if (bc) {
      const { data: taken } = await db.from('products').select('id').eq('barcode', bc).neq('id', b.product_id).maybeSingle();
      if (!taken) await db.from('products').update({ barcode: bc }).eq('id', b.product_id).is('barcode', null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
