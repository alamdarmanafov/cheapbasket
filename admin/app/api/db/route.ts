import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

// A whole-table read still walks its pages in one call when a caller asks for
// `fetchAll`; give it room, the UI's own paging (`range`) stays well under.
export const maxDuration = 60;

// Every table the admin UI may reach through this gateway. A page whose table is
// missing here fails with "Cədvəl icazəli deyil" on read *and* write, so add the
// table in the same change that adds the page.
const TABLES = new Set([
  'stores', 'products', 'prices', 'price_history', 'branches', 'profiles', 'push_tokens',
  'baskets', 'admin_users', 'banners', 'categories', 'feedback', 'promo_codes',
  'promo_redemptions', 'events', 'popups', 'ai_logs', 'iap_events',
  'price_quarantine', 'price_requests', 'partner_uploads',
]);

type Op =
  | { op: 'select'; table: string; columns?: string; order?: string; eq?: Record<string, unknown>; limit?: number; fetchAll?: boolean; range?: [number, number] }
  | { op: 'count'; table: string; eq?: Record<string, unknown> }
  | { op: 'upsert'; table: string; rows: Record<string, unknown>[]; onConflict?: string }
  | { op: 'delete'; table: string; eq: Record<string, unknown> }
  | { op: 'rpc'; fn: string; args?: Record<string, unknown> };

// Database functions the UI may call by name. Each one is service-role only
// in SQL, so this list is the whole of what the admin cookie unlocks.
const FUNCTIONS = new Set(['merge_products']);

// Paging needs a fixed order or two pages can overlap; the key column is the
// one order every table has. `id` unless the table spells it differently.
const KEY: Record<string, string> = { prices: 'product_id', profiles: 'user_id', push_tokens: 'token', promo_codes: 'code', admin_users: 'email' };

/** Tiny data gateway for the admin UI: cookie-protected, whitelisted tables, service role on the server. */
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  const body = (await req.json()) as Op;
  if (body.op === 'rpc') {
    if (!FUNCTIONS.has(body.fn)) return NextResponse.json({ error: 'Funksiya icazəli deyil' }, { status: 400 });
    const { data, error } = await adminDb().rpc(body.fn, body.args ?? {});
    if (error) return NextResponse.json({ error: errText(error) }, { status: 500 });
    return NextResponse.json({ data });
  }
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
      // One page of a table: the UI asks for the next one itself.
      if (body.range) {
        const [from, to] = body.range;
        let q = buildQ();
        if (!body.order) q = q.order(KEY[body.table] ?? 'id');
        const { data, error } = await q.range(Math.max(0, from), Math.min(to, from + 999));
        if (error) throw error;
        return NextResponse.json({ data });
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
