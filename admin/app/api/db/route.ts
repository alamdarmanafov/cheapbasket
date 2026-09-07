import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

const TABLES = new Set(['stores', 'products', 'prices', 'price_history', 'branches', 'profiles', 'push_tokens', 'baskets', 'admin_users', 'banners', 'categories', 'feedback']);

type Op =
  | { op: 'select'; table: string; columns?: string; order?: string; eq?: Record<string, unknown>; limit?: number }
  | { op: 'count'; table: string; eq?: Record<string, unknown> }
  | { op: 'upsert'; table: string; rows: Record<string, unknown>[]; onConflict?: string }
  | { op: 'delete'; table: string; eq: Record<string, unknown> };

/** Tiny data gateway for the admin UI: cookie-protected, whitelisted tables, service role on the server. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Op;
  if (!TABLES.has(body.table)) return NextResponse.json({ error: 'Cədvəl icazəli deyil' }, { status: 400 });
  try {
    const db = adminDb();
    if (body.op === 'select') {
      let q = db.from(body.table).select(body.columns ?? '*');
      for (const [k, v] of Object.entries(body.eq ?? {})) q = q.eq(k, v as never);
      if (body.order) q = q.order(body.order);
      if (body.limit) q = q.limit(body.limit);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ data });
    }
    if (body.op === 'count') {
      let q = db.from(body.table).select('*', { count: 'exact', head: true });
      for (const [k, v] of Object.entries(body.eq ?? {})) q = q.eq(k, v as never);
      const { count, error } = await q;
      if (error) throw error;
      return NextResponse.json({ count: count ?? 0 });
    }
    if (body.op === 'upsert') {
      const { error } = await db.from(body.table).upsert(body.rows, body.onConflict ? { onConflict: body.onConflict } : undefined);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (body.op === 'delete') {
      let q = db.from(body.table).delete();
      const entries = Object.entries(body.eq ?? {});
      if (!entries.length) throw new Error('delete filter tələb olunur');
      for (const [k, v] of entries) q = q.eq(k, v as never);
      const { error } = await q;
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Naməlum əməliyyat' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
