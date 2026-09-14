import { NextResponse } from 'next/server';
import { adminDb, errText, fetchAll, requireAdmin } from '@/lib/server';
import { buildMatcher, MatchableProduct } from '@/lib/wolt';
import { normalizeGtin } from '@/lib/gtin';

export const maxDuration = 60;

interface Row { barcode: string | null; name: string; brand: string | null; size: string | null; price: number }

/** GET ?id= → one upload with each row matched to a catalogue product; without id, the list. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) {
      const { data, error } = await db.from('partner_uploads').select('id, store_id, filename, note, row_count, status, applied, created_at, decided_at, stores(name)').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return NextResponse.json({ uploads: data ?? [] });
    }
    const { data: up, error } = await db.from('partner_uploads').select('*').eq('id', id).single();
    if (error || !up) return NextResponse.json({ error: 'Tapılmadı' }, { status: 404 });
    const products = await fetchAll<MatchableProduct>((a, b) => db.from('products').select('id, barcode, brand, name, size').range(a, b));
    const match = buildMatcher(products);
    const byId = new Map(products.map((p) => [p.id, `${p.brand} ${p.name} ${p.size}`.trim()]));
    const { data: cur } = await db.from('prices').select('product_id, price').eq('store_id', up.store_id);
    const priceNow = new Map((cur ?? []).map((r: { product_id: string; price: number | null }) => [r.product_id, r.price == null ? null : Number(r.price)]));
    const rows = (up.rows as Row[]).map((r) => {
      const pid = match({ barcode: normalizeGtin(r.barcode), name: r.name || r.barcode || '', brand: r.brand ?? '', size: r.size ?? '' } as Parameters<typeof match>[0]);
      return { ...r, product_id: pid, product_name: pid ? byId.get(pid) ?? pid : null, current: pid ? priceNow.get(pid) ?? null : null };
    });
    return NextResponse.json({ upload: { ...up, rows: undefined }, rows });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}

/** POST { op: 'apply', id, items: [{ product_id, price }] } | { op: 'reject', id } */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const body = (await req.json()) as { op: string; id: string; items?: Array<{ product_id: string; price: number }> };
    const { data: up } = await db.from('partner_uploads').select('id, store_id, status').eq('id', body.id).single();
    if (!up) return NextResponse.json({ error: 'Tapılmadı' }, { status: 404 });
    if (up.status !== 'pending') return NextResponse.json({ error: 'Bu yükləməyə artıq baxılıb' }, { status: 409 });
    if (body.op === 'reject') {
      await db.from('partner_uploads').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', body.id);
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'apply') {
      const items = (body.items ?? []).filter((it) => it.product_id && Number.isFinite(Number(it.price)) && Number(it.price) > 0);
      const now = new Date().toISOString();
      const rows = [...new Map(items.map((it) => [it.product_id, { product_id: it.product_id, store_id: up.store_id, price: Math.round(Number(it.price) * 100) / 100, source: 'partner', updated_at: now }])).values()];
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await db.from('prices').upsert(rows.slice(i, i + 200), { onConflict: 'product_id,store_id' });
        if (error) throw error;
      }
      // The anomaly guard may have parked some of these; count what landed.
      const { data: landed } = await db.from('prices').select('product_id').eq('store_id', up.store_id).eq('source', 'partner').gte('updated_at', now);
      await db.from('partner_uploads').update({ status: 'applied', applied: landed?.length ?? 0, decided_at: now }).eq('id', body.id);
      return NextResponse.json({ ok: true, applied: landed?.length ?? 0, parked: rows.length - (landed?.length ?? 0) });
    }
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
