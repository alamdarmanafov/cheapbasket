import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';
import { runSync } from '@/lib/sync';
import { getAlertSettings } from '@/lib/alerts';

export const maxDuration = 60;

/** Admin: list saved Wolt sources; add/remove/toggle; run now. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const [{ data: sources, error }, alerts] = await Promise.all([adminDb().from('import_sources').select('*').order('created_at'), getAlertSettings()]);
  if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
  return NextResponse.json({ sources: sources ?? [], alerts, cron: !!process.env.CRON_SECRET });
}

type Body = { op: 'add'; store_id: string; url: string } | { op: 'delete'; id: string } | { op: 'toggle'; id: string; enabled: boolean } | { op: 'run'; id?: string } | { op: 'alerts'; value: unknown };

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
    if (body.op === 'alerts') {
      const { error } = await db.from('app_settings').upsert({ key: 'alerts', value: body.value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'run') return NextResponse.json(await runSync({ onlyId: body.id }));
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
