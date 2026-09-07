import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';
import { searchWoltVenues } from '@/lib/wolt';
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
        rows.push({
          id: slugify(`${store.id} ${v.name} ${(v.address ?? '').slice(0, 20)}`),
          store_id: store.id, name: v.name, address: v.address ?? '',
          lat: v.lat, lng: v.lng, maps_url: v.url,
          open_from: v.open_from ?? null, open_until: v.open_until ?? null,
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
