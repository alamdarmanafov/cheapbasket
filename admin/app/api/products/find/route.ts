import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { Candidate, feedItems, rank } from '@/lib/find';
import { normalizeGtin } from '@/lib/gtin';

export const maxDuration = 120;

interface StoreResult { store_id: string; store_name: string; have: number | null; sources: number; candidates: Candidate[]; linked: string | null; error?: string }

/** POST { product_id } → for every store with a feed, the closest items and their prices. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const { product_id } = (await req.json()) as { product_id: string };
    const db = adminDb();
    const [{ data: product }, { data: stores }, { data: sources }, { data: prices }, { data: links }] = await Promise.all([
      db.from('products').select('id, brand, name, size, barcode').eq('id', product_id).maybeSingle(),
      db.from('stores').select('id, name').order('name'),
      db.from('import_sources').select('store_id, url').eq('enabled', true),
      db.from('prices').select('store_id, price').eq('product_id', product_id),
      db.from('product_links').select('store_id, ext_id').eq('product_id', product_id),
    ]);
    if (!product) return NextResponse.json({ error: 'Məhsul tapılmadı' }, { status: 404 });
    const have = new Map((prices ?? []).map((p) => [p.store_id as string, Number(p.price)]));
    const linked = new Map((links ?? []).map((l) => [l.store_id as string, l.ext_id as string]));
    const results: StoreResult[] = await Promise.all(
      (stores ?? []).map(async (s): Promise<StoreResult> => {
        const urls = (sources ?? []).filter((x) => x.store_id === s.id).map((x) => x.url as string);
        const base: StoreResult = { store_id: s.id, store_name: s.name, have: have.get(s.id) ?? null, sources: urls.length, candidates: [], linked: linked.get(s.id) ?? null };
        if (!urls.length) return base;
        const seen = new Map<string, Candidate>();
        const errors: string[] = [];
        await Promise.all(urls.map(async (u) => {
          try {
            const { items } = await feedItems(u);
            for (const c of rank(product, items, 5)) if (!seen.has(c.ext_id) || (seen.get(c.ext_id)?.score ?? 0) < c.score) seen.set(c.ext_id, c);
          } catch (e) { errors.push(errText(e)); }
        }));
        return { ...base, candidates: [...seen.values()].sort((a, b) => b.score - a.score).slice(0, 3), error: errors.length && !seen.size ? errors[0] : undefined };
      }),
    );
    return NextResponse.json({ product, results });
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
