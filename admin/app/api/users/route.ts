import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

/** User management that needs the auth admin API (delete) or profile writes. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as
    | { op: 'plan'; user_id: string; plan: 'free' | 'plus'; days?: number | null; note?: string | null }
    | { op: 'extend'; user_id: string; days: number }
    | { op: 'block'; user_id: string; blocked: boolean }
    | { op: 'delete'; user_id: string };
  try {
    const db = adminDb();
    const now = new Date().toISOString();
    if (body.op === 'plan') {
      const expires = body.plan === 'plus' && body.days ? new Date(Date.now() + body.days * 86400000).toISOString() : null;
      const { error } = await db.from('profiles').upsert({ user_id: body.user_id, plan: body.plan, plan_expires_at: expires, plan_note: body.note ?? null, updated_at: now });
      if (error) throw error;
      return NextResponse.json({ ok: true, expires });
    }
    if (body.op === 'extend') {
      const { data } = await db.from('profiles').select('plan_expires_at').eq('user_id', body.user_id).maybeSingle();
      const base = data?.plan_expires_at && new Date(data.plan_expires_at) > new Date() ? new Date(data.plan_expires_at) : new Date();
      const expires = new Date(base.getTime() + body.days * 86400000).toISOString();
      const { error } = await db.from('profiles').upsert({ user_id: body.user_id, plan: 'plus', plan_expires_at: expires, updated_at: now });
      if (error) throw error;
      return NextResponse.json({ ok: true, expires });
    }
    if (body.op === 'block') {
      const { error } = await db.from('profiles').upsert({ user_id: body.user_id, blocked: body.blocked, updated_at: now });
      if (error) throw error;
      if (body.blocked) await db.auth.admin.signOut(body.user_id).catch(() => undefined);
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'delete') {
      const { error } = await db.auth.admin.deleteUser(body.user_id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
