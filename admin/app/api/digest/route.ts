import { NextResponse } from 'next/server';
import { aiProvider, getSettings, runDigest } from '@/lib/digest';
import { adminDb, errText, requireAdmin } from '@/lib/server';

export const maxDuration = 60;

/** Admin UI: read/update digest settings, preview or send now. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const db = adminDb();
  const [settings, { data: last }, { data: drops }] = await Promise.all([
    getSettings(),
    db.from('digest_log').select('sent_at, title, body').order('sent_at', { ascending: false }).limit(5),
    db.from('price_drops').select('*').order('changed_at', { ascending: false }).limit(20),
  ]);
  return NextResponse.json({ settings, last: last ?? [], drops: drops ?? [], ai: aiProvider(), cron: !!process.env.CRON_SECRET });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as { op: 'settings'; value: unknown } | { op: 'run'; force?: boolean; dryRun?: boolean };
  try {
    if (body.op === 'settings') {
      const { error } = await adminDb().from('app_settings').upsert({ key: 'digest', value: body.value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    const r = await runDigest({ force: body.force, dryRun: body.dryRun });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
