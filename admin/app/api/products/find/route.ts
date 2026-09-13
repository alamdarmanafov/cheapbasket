import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { Candidate, feedItems, rank, searchQuery, siteSearchUrl } from '@/lib/find';
import { normalizeGtin } from '@/lib/gtin';

export const maxDuration = 60;

interface StoreResult { store_id: string; store_name: string; have: number | null; sources: number; candidates: Candidate[]; linked: string | null; error?: string }

/** GET ?store_id&q&url → does the site search read anything? (the stores page's check button) */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const u = new URL(req.url);
  const template = u.searchParams.get('url') ?? '';
  const q = u.searchParams.get('q') ?? 'süd';
  const target = siteSearchUrl(template, q);
  if (!target) return NextResponse.json({ error: 'URL-də {q} olmalıdır' }, { status: 400 });
  try {
    const { items } = await feedItems(target, 5 * 60 * 1000, { maxPages: 2, budgetMs: 25_000 });
    return NextResponse.json({ count: items.length, sample: items.slice(0, 3).map((i) => `${i.name} ${i.price ?? '?'} ₼`) });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

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
      db.from('stores').select('id, name, search_url').eq('id', store_id).maybeSingle(),
      db.from('import_sources').select('url').eq('store_id', store_id).eq('enabled', true),
      db.from('prices').select('price').eq('product_id', product_id).eq('store_id', store_id).maybeSingle(),
      db.from('product_links').select('ext_id').eq('product_id', product_id).eq('store_id', store_id).maybeSingle(),
    ]);
    if (!product) return NextResponse.json({ error: 'Məhsul tapılmadı' }, { status: 404 });
    if (!store) return NextResponse.json({ error: 'Market tapılmadı' }, { status: 404 });
    const urls = (sources ?? []).map((x) => x.url as string);
    // The store's own site search, when it has one: opened with the product's
    // words, read like any other page. Its item ids are positions on a results
    // page, so nothing durable is linked; the price is what it gives.
    const site = siteSearchUrl((store as { search_url?: string | null }).search_url, searchQuery(product));
    const result: StoreResult = { store_id: store.id, store_name: store.name, have: price ? Number(price.price) : null, sources: urls.length + (site ? 1 : 0), candidates: [], linked: link?.ext_id ?? null };
    const seen = new Map<string, Candidate>();
    const errors: string[] = [];
    for (const u of urls) {
      try {
        const { items } = await feedItems(u);
        for (const c of rank(product, items, 5)) if (!seen.has(c.ext_id) || (seen.get(c.ext_id)?.score ?? 0) < c.score) seen.set(c.ext_id, c);
      } catch (e) { errors.push(errText(e)); }
    }
    if (site) {
      try {
        const { items } = await feedItems(site, 10 * 60 * 1000, { maxPages: 2, budgetMs: 25_000 });
        for (const c of rank(product, items, 5)) seen.set(`web:${c.ext_id}`, { ...c, ext_id: `web:${c.ext_id}`, web: true });
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
    if (!b.ext_id.startsWith('web:')) {
      const { error: e1 } = await db.from('product_links').upsert({ store_id: b.store_id, ext_id: b.ext_id, product_id: b.product_id }, { onConflict: 'store_id,ext_id' });
      if (e1) throw e1;
    }
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
