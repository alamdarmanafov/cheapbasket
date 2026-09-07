import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';
import { searchWoltVenues, fetchWoltVenueInfo } from '@/lib/wolt';
import { slugify } from '@/lib/supabase';

export const maxDuration = 300;

/** Vercel Cron (weekly Sunday 4am UTC): auto-import branches from Wolt for every store. */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = adminDb();
  const { data: stores, error: storeErr } = await db.from('stores').select('id, name');
  if (storeErr) return NextResponse.json({ error: errText(storeErr) }, { status: 500 });

  const results: Array<{ store: string; upserted: number; error?: string }> = [];
  for (const store of stores ?? []) {
    try {
      const { venues } = await searchWoltVenues(store.name);
      const rows: Record<string, unknown>[] = [];
      for (const v of venues) {
        if (!v.lat || !v.lng) continue;
        const info = await fetchWoltVenueInfo(v.slug).catch(() => null);
        const b = info ?? v;
        rows.push({
          id: slugify(`${store.id} ${v.name} ${(v.address ?? '').slice(0, 20)}`),
          store_id: store.id, name: b.name, address: b.address ?? '',
          lat: b.lat, lng: b.lng, maps_url: b.url,
          open_from: b.open_from ?? null, open_until: b.open_until ?? null,
        });
      }
      if (rows.length) { const { error } = await db.from('branches').upsert(rows, { onConflict: 'id' }); if (error) throw error; }
      results.push({ store: store.name, upserted: rows.length });
    } catch (e) {
      results.push({ store: store.name, upserted: 0, error: errText(e) });
    }
  }
  return NextResponse.json({ results, total: results.reduce((s, r) => s + r.upserted, 0) });
}
