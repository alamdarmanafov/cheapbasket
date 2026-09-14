import { NextResponse } from 'next/server';
import { adminDb, errText, fetchAll, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

const FRESH_DAYS = 14;
const SIZE_RE = /\d+([.,]\d+)?\s*(ml|l|lt|litr|q|qr|g|gr|kq|kg|əd|ədəd|eded|pcs|x|м|мл|л|г|кг|шт)\b/i;

interface Prod { id: string; name: string; brand: string; barcode: string | null; image_url: string | null; size: string; category: string }
interface PriceRow { product_id: string; store_id: string; updated_at: string | null }

/**
 * GET: the catalogue's health in one screen — what share of products has a
 * barcode, a photo, a readable size, a category, a price at two stores and a
 * fresh price — with the twenty products most worth fixing first (the ones
 * shoppers actually touch, missing the most), the parked prices, and the open
 * requests and partner uploads waiting on a decision.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [products, prices, stores, quarantine, requests, partners, mq, pending, events] = await Promise.all([
      fetchAll<Prod>((a, b) => db.from('products').select('id, name, brand, barcode, image_url, size, category').range(a, b)),
      fetchAll<PriceRow>((a, b) => db.from('prices').select('product_id, store_id, updated_at').not('price', 'is', null).range(a, b)),
      db.from('stores').select('id, name, color').order('name'),
      db.from('price_quarantine').select('id, product_id, store_id, old_price, new_price, discount_price, reference, source, created_at, products(name, brand, size), stores(name)').eq('status', 'open').order('created_at', { ascending: false }).limit(200),
      db.from('price_requests').select('id, product_id, store_id, status, notified, created_at, products(name, brand, size), stores(name)').eq('status', 'open').order('created_at', { ascending: false }).limit(100),
      db.from('partner_uploads').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('match_queue').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      db.from('pending_products').select('*', { count: 'exact', head: true }),
      db.from('events').select('meta').in('kind', ['scan', 'basket_add', 'watch']).gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
    ]);
    const storeList = (stores.data ?? []) as Array<{ id: string; name: string; color: string }>;
    const byProduct = new Map<string, PriceRow[]>();
    for (const p of prices) byProduct.set(p.product_id, [...(byProduct.get(p.product_id) ?? []), p]);
    const hot = new Map<string, number>();
    for (const e of (events.data ?? []) as Array<{ meta: { product_id?: string } | null }>) {
      const id = e.meta?.product_id;
      if (id) hot.set(id, (hot.get(id) ?? 0) + 1);
    }
    const freshCut = Date.now() - FRESH_DAYS * 86400000;
    const flags = { barcode: 0, image: 0, size: 0, category: 0, twoStores: 0, fresh: 0 };
    const fixes: Array<{ id: string; name: string; missing: string[]; hot: number; stores: number }> = [];
    for (const p of products) {
      const rows = byProduct.get(p.id) ?? [];
      const missing: string[] = [];
      if (p.barcode) flags.barcode++; else missing.push('barkod');
      if (p.image_url) flags.image++; else missing.push('şəkil');
      if (SIZE_RE.test(p.size ?? '')) flags.size++; else missing.push('ölçü');
      if (p.category && p.category.trim()) flags.category++; else missing.push('kateqoriya');
      if (rows.length >= 2) flags.twoStores++; else missing.push(rows.length === 0 ? 'qiymət yoxdur' : '2-ci market');
      const fresh = rows.length > 0 && rows.some((r) => r.updated_at && new Date(r.updated_at).getTime() > freshCut);
      if (fresh) flags.fresh++; else if (rows.length) missing.push('köhnə qiymət');
      if (missing.length) fixes.push({ id: p.id, name: `${p.brand} ${p.name} ${p.size}`.trim(), missing, hot: hot.get(p.id) ?? 0, stores: rows.length });
    }
    fixes.sort((a, b) => b.hot - a.hot || b.missing.length - a.missing.length || a.name.localeCompare(b.name));
    const total = products.length || 1;
    const pct = (n: number) => Math.round((n / total) * 100);
    const perStore = storeList.map((s) => {
      const rows = prices.filter((r) => r.store_id === s.id);
      const stale = rows.filter((r) => !r.updated_at || new Date(r.updated_at).getTime() <= freshCut).length;
      return { ...s, priced: rows.length, stale };
    });
    const score = Math.round((pct(flags.barcode) + pct(flags.image) + pct(flags.size) + pct(flags.category) + pct(flags.twoStores) * 2 + pct(flags.fresh) * 2) / 8);
    return NextResponse.json({
      total: products.length,
      score,
      flags: { barcode: pct(flags.barcode), image: pct(flags.image), size: pct(flags.size), category: pct(flags.category), twoStores: pct(flags.twoStores), fresh: pct(flags.fresh) },
      counts: flags,
      perStore,
      fixes: fixes.slice(0, 20),
      queues: { quarantine: quarantine.data?.length ?? 0, requests: requests.data?.length ?? 0, partners: partners.count ?? 0, matches: mq.count ?? 0, pending: pending.count ?? 0 },
      quarantine: quarantine.data ?? [],
      requests: requests.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** POST { op: 'quarantine', id, accept } | { op: 'close_request', id } */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const body = (await req.json()) as { op: string; id: string; accept?: boolean };
    if (body.op === 'quarantine') {
      const { error } = await db.rpc('apply_quarantine', { p_id: body.id, p_accept: !!body.accept });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'close_request') {
      const { error } = await db.from('price_requests').update({ status: 'answered', answered_at: new Date().toISOString() }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
