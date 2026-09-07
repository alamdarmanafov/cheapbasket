import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { searchWoltVenues } from '@/lib/wolt';

export const maxDuration = 120;

/** POST /api/import/wolt/branches
 * For every store, searches Wolt and upserts found venues as branches.
 * Returns per-store results.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const db = adminDb();
  const { data: stores, error: storeErr } = await db.from('stores').select('id, name');
  if (storeErr) return NextResponse.json({ error: errText(storeErr) }, { status: 500 });

  const results: Array<{ store: string; found: number; upserted: number; error?: string }> = [];

  for (const store of stores ?? []) {
    try {
      const { venues } = await searchWoltVenues(store.name);
      if (!venues.length) { results.push({ store: store.name, found: 0, upserted: 0 }); continue; }

      const rows: Record<string, unknown>[] = [];
      for (const v of venues) {
        if (!v.lat || !v.lng) continue;
        rows.push({
          id: `${store.id}-${v.slug}`,
          store_id: store.id,
          name: v.name,
          address: v.address ?? '',
          lat: v.lat,
          lng: v.lng,
          maps_url: v.url,
          open_from: v.open_from ?? null,
          open_until: v.open_until ?? null,
        });
      }

      if (rows.length) {
        const { error } = await db.from('branches').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      results.push({ store: store.name, found: venues.length, upserted: rows.length });
    } catch (e) {
      results.push({ store: store.name, found: 0, upserted: 0, error: errText(e) });
    }
  }

  return NextResponse.json({ results, total: results.reduce((s, r) => s + r.upserted, 0) });
}
