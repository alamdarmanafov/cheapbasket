import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { runSync } from '@/lib/sync';
import { getAlertSettings } from '@/lib/alerts';
import { fetchAnySource } from '@/lib/wolt';

export const maxDuration = 300;

/** Admin: list saved Wolt sources; add/remove/toggle; run now. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const [{ data: sources, error }, alerts] = await Promise.all([adminDb().from('import_sources').select('*').order('created_at'), getAlertSettings()]);
  if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
  return NextResponse.json({ sources: sources ?? [], alerts, cron: !!process.env.CRON_SECRET });
}

type Body = { op: 'add'; store_id: string; url: string } | { op: 'delete'; id: string } | { op: 'toggle'; id: string; enabled: boolean } | { op: 'run'; id?: string } | { op: 'alerts'; value: unknown } | { op: 'test'; id: string } | { op: 'scope'; id: string; sync_products?: boolean; sync_prices?: boolean };

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Body;
  try {
    const db = adminDb();
    if (body.op === 'add') {
      const { error } = await db.from('import_sources').upsert({ store_id: body.store_id, url: body.url.trim() }, { onConflict: 'store_id,url' });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'delete') {
      const { error } = await db.from('import_sources').delete().eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'toggle') {
      const { error } = await db.from('import_sources').update({ enabled: body.enabled }).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    // What this source pulls: products, prices, or both.
    if (body.op === 'scope') {
      const patch: Record<string, boolean> = {};
      if (typeof body.sync_products === 'boolean') patch.sync_products = body.sync_products;
      if (typeof body.sync_prices === 'boolean') patch.sync_prices = body.sync_prices;
      const { error } = await db.from('import_sources').update(patch).eq('id', body.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'alerts') {
      const { error } = await db.from('app_settings').upsert({ key: 'alerts', value: body.value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'run') return NextResponse.json(await runSync({ onlyId: body.id }));
    if (body.op === 'test') {
      const { data: src, error: srcErr } = await db.from('import_sources').select('id, store_id, url').eq('id', body.id).single();
      if (srcErr || !src) return NextResponse.json({ ok: false, error: 'Mənbə tapılmadı' });
      try {
        const venue = await fetchAnySource(src.url);
        return NextResponse.json({ ok: true, found: venue.items.length, venue: venue.venue });
      } catch (e) {
        return NextResponse.json({ ok: false, error: errText(e) });
      }
    }
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
