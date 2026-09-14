import { NextResponse } from 'next/server';
import { adminDb, errText, fetchAll, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

interface CoreRow { id: string; brand: string; name: string; size: string; barcode: string | null; category: string; score: number; baskets: number; scans: number; adds: number; stores: string[] }

/**
 * The products people actually reach for, and how many stores price each.
 *
 * Popularity is what the last 30 days of events say (scans, basket adds,
 * watches, price reports) plus what sits in baskets right now. A popular
 * product priced at one store is the gap worth closing first; this is the
 * list the admin works down with "Marketlərdə tap".
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [products, prices, events, baskets] = await Promise.all([
      fetchAll<{ id: string; brand: string; name: string; size: string; barcode: string | null; category: string }>((f, t) => db.from('products').select('id, brand, name, size, barcode, category').range(f, t)),
      fetchAll<{ product_id: string; store_id: string }>((f, t) => db.from('prices').select('product_id, store_id').range(f, t)),
      fetchAll<{ kind: string; meta: { product_id?: string | null } | null }>((f, t) => db.from('events').select('kind, meta').in('kind', ['scan', 'basket_add', 'watch', 'price_report']).gte('created_at', since).range(f, t)),
      fetchAll<{ product_id: string }>((f, t) => db.from('basket_items').select('product_id').range(f, t)),
    ]);
    const stores = new Map<string, string[]>();
    for (const p of prices) stores.set(p.product_id, [...(stores.get(p.product_id) ?? []), p.store_id]);
    const scans = new Map<string, number>(), adds = new Map<string, number>(), other = new Map<string, number>();
    for (const e of events) {
      const id = e.meta?.product_id;
      if (!id) continue;
      const m = e.kind === 'scan' ? scans : e.kind === 'basket_add' ? adds : other;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    const inBaskets = new Map<string, number>();
    for (const b of baskets) inBaskets.set(b.product_id, (inBaskets.get(b.product_id) ?? 0) + 1);
    const rows: CoreRow[] = products
      .map((p) => {
        const s = scans.get(p.id) ?? 0, a = adds.get(p.id) ?? 0, o = other.get(p.id) ?? 0, b = inBaskets.get(p.id) ?? 0;
        return { ...p, scans: s, adds: a, baskets: b, score: b * 3 + a * 2 + s + o, stores: stores.get(p.id) ?? [] };
      })
      .filter((r) => r.score > 0)
      .sort((x, y) => y.score - x.score || x.stores.length - y.stores.length)
      .slice(0, 300);
    return NextResponse.json({ rows, since });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
