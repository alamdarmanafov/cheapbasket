import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

// Every table the admin UI may reach through this gateway. A page whose table is
// missing here fails with "Cədvəl icazəli deyil" on read *and* write, so add the
// table in the same change that adds the page.
const TABLES = new Set([
  'stores', 'products', 'prices', 'price_history', 'branches', 'profiles', 'push_tokens',
  'baskets', 'admin_users', 'banners', 'categories', 'feedback', 'promo_codes',
  'promo_redemptions', 'events', 'popups', 'ai_logs',
]);

type Op =
  | { op: 'select'; table: string; columns?: string; order?: string; eq?: Record<string, unknown>; limit?: number; fetchAll?: boolean }
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
      const buildQ = () => {
        let q = db.from(body.table).select(body.columns ?? '*');
        for (const [k, v] of Object.entries(body.eq ?? {})) q = q.eq(k, v as never);
        if (body.order) q = q.order(body.order);
        return q;
      };
      if (body.fetchAll) {
        const PAGE = 1000;
        let offset = 0;
        const all: unknown[] = [];
        while (true) {
          const { data, error } = await buildQ().range(offset, offset + PAGE - 1);
          if (error) throw error;
          all.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
          offset += PAGE;
        }
        return NextResponse.json({ data: all });
      }
      const q = buildQ();
      const { data, error } = await (body.limit ? q.limit(body.limit) : q);
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
