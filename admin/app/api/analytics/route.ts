import { NextResponse } from 'next/server';
import { adminDb, errText, requireAdmin } from '@/lib/server';

export const maxDuration = 30;
const DAY = 86400000;
const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 4 * 3600000).toISOString().slice(0, 10); // Baku day

/** Admin dashboard numbers: users, Plus conversion, activity per day, top products/stores, AI usage, feedback. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Giriş tələb olunur' }, { status: 401 });
  try {
    const db = adminDb();
    const since30 = new Date(Date.now() - 30 * DAY).toISOString();
    const since7 = new Date(Date.now() - 7 * DAY).toISOString();
    const [{ data: users }, { data: profiles }, { data: events }, { data: products }, { data: stores }, { data: iap }, { data: feedbackNew }, { data: tokens }, { data: promos }] = await Promise.all([
      db.rpc('admin_users_list').select('id, created_at, last_sign_in_at'),
      db.from('profiles').select('user_id, plan, plan_expires_at, plan_source'),
      db.from('events').select('user_id, kind, meta, created_at').gte('created_at', since30).order('created_at', { ascending: false }).limit(20000),
      db.from('products').select('id, brand, name, size'),
      db.from('stores').select('id, name, color, initial'),
      db.from('iap_events').select('platform, event, created_at').gte('created_at', since30),
      db.from('feedback').select('id').eq('status', 'new'),
      db.from('push_tokens').select('user_id'),
      db.from('promo_redemptions').select('code, created_at').gte('created_at', since30),
    ]);

    type U = { id: string; created_at: string; last_sign_in_at: string | null };
    const list = (Array.isArray(users) ? users : users ? [users] : []) as U[];
    const now = Date.now();
    const plusActive = (profiles ?? []).filter((p) => p.plan === 'plus' && (!p.plan_expires_at || new Date(p.plan_expires_at).getTime() > now));
    const ev = events ?? [];

    // Daily series (last 14 days): active users (distinct user ids from events + sign-ins) and new users.
    const days: Array<{ day: string; active: number; new: number; scans: number; compares: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = dayKey(new Date(now - i * DAY).toISOString());
      const dayEv = ev.filter((e) => dayKey(e.created_at) === d);
      const active = new Set(dayEv.map((e) => e.user_id).filter(Boolean));
      list.filter((u) => u.last_sign_in_at && dayKey(u.last_sign_in_at) === d).forEach((u) => active.add(u.id));
      days.push({ day: d, active: active.size, new: list.filter((u) => dayKey(u.created_at) === d).length, scans: dayEv.filter((e) => e.kind === 'scan' || e.kind === 'photo').length, compares: dayEv.filter((e) => e.kind === 'compare').length });
    }
    const active7 = new Set(ev.filter((e) => e.created_at >= since7 && e.user_id).map((e) => e.user_id));
    list.filter((u) => u.last_sign_in_at && u.last_sign_in_at >= since7).forEach((u) => active7.add(u.id));

    const countBy = (kind: string, key: string) => {
      const m = new Map<string, number>();
      for (const e of ev) if (e.kind === kind) { const v = (e.meta as Record<string, unknown> | null)?.[key]; if (typeof v === 'string') m.set(v, (m.get(v) ?? 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    };
    const pname = (id: string) => { const p = (products ?? []).find((x) => x.id === id); return p ? `${p.brand} ${p.name} ${p.size}` : id; };
    const sname = (id: string) => (stores ?? []).find((x) => x.id === id);
    const kinds = ['app_open', 'search', 'scan', 'photo', 'basket_add', 'compare', 'map_open', 'plus_view', 'promo'] as const;
    const byKind = Object.fromEntries(kinds.map((k) => [k, { d7: ev.filter((e) => e.kind === k && e.created_at >= since7).length, d30: ev.filter((e) => e.kind === k).length }]));
    const searchesNoResult = countBy('search', 'q').length ? ev.filter((e) => e.kind === 'search' && (e.meta as { results?: number } | null)?.results === 0).map((e) => (e.meta as { q: string }).q) : [];
    const topMissing = [...searchesNoResult.reduce((m, q) => m.set(q.toLowerCase(), (m.get(q.toLowerCase()) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const compares = ev.filter((e) => e.kind === 'compare');
    const savingAvg = compares.length ? compares.reduce((a, e) => a + Number((e.meta as { saving?: number } | null)?.saving ?? 0), 0) / compares.length : 0;

    return NextResponse.json({
      users: { total: list.length, new7: list.filter((u) => u.created_at >= since7).length, new30: list.filter((u) => u.created_at >= since30).length, active7: active7.size, activeToday: days[days.length - 1]?.active ?? 0, devices: new Set((tokens ?? []).map((t) => t.user_id)).size },
      plus: { active: plusActive.length, conversion: list.length ? Math.round((plusActive.length / list.length) * 1000) / 10 : 0, bySource: Object.fromEntries(['apple', 'google', 'promo', 'manual'].map((s) => [s, plusActive.filter((p) => (p.plan_source ?? 'manual') === s).length])), purchases30: (iap ?? []).filter((i) => i.event === 'verify').length, promos30: (promos ?? []).length },
      days,
      byKind,
      topBasket: countBy('basket_add', 'product_id').map(([id, n]) => ({ id, name: pname(id), n })),
      topScanned: countBy('scan', 'product_id').map(([id, n]) => ({ id, name: pname(id), n })),
      bestStores: countBy('compare', 'store_id').map(([id, n]) => ({ id, store: sname(id), n })),
      topMissing: topMissing.map(([q, n]) => ({ q, n })),
      compareStats: { count30: compares.length, savingAvg: Math.round(savingAvg * 100) / 100 },
      feedbackNew: (feedbackNew ?? []).length,
    });
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
