import { adminDb } from './server';
import { copy, langOf } from './pushCopy';

export interface AlertSettings { enabled: boolean; plus_only: boolean; min_percent: number }
const DEFAULTS: AlertSettings = { enabled: true, plus_only: true, min_percent: 3 };

export async function getAlertSettings(): Promise<AlertSettings> {
  const { data } = await adminDb().from('app_settings').select('value').eq('key', 'alerts').maybeSingle();
  return { ...DEFAULTS, ...((data?.value as Partial<AlertSettings>) ?? {}) };
}

interface Drop { product_id: string; store_id: string; new_price: number; old_price: number; drop_percent: number; changed_at: string; name: string; brand: string; size: string; store_name: string }
const isPlus = (p: { plan?: string | null; plan_expires_at?: string | null }) => p.plan === 'plus' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date());

/**
 * Instant "your basket item got cheaper" push: every price drop recorded since `sinceIso`
 * is matched against users' baskets; each user gets one push per run, never the same drop twice in 24h.
 */
export async function notifyRecentDrops(sinceIso: string, opts: { dryRun?: boolean } = {}) {
  const db = adminDb();
  const settings = await getAlertSettings();
  if (!settings.enabled) return { skipped: 'disabled', users: 0, sent: 0, preview: [] as Array<{ user_id: string; body: string }> };

  const { data: dropsRaw } = await db.from('price_drops').select('*').gte('changed_at', sinceIso).order('drop_percent', { ascending: false }).limit(500);
  const drops = ((dropsRaw ?? []) as Drop[]).filter((d) => Number(d.drop_percent) >= settings.min_percent);
  if (!drops.length) return { users: 0, sent: 0, preview: [] };
  const productIds = [...new Set(drops.map((d) => d.product_id))];

  // Two ways to care about a product: it is in the basket, or it is watched
  // with the bell on its page (price_alerts — a table that waited since 0003
  // for the app to use it). Either earns the push.
  const [{ data: items }, { data: watched }] = await Promise.all([
    db.from('basket_items').select('product_id, baskets!inner(user_id)').in('product_id', productIds),
    db.from('price_alerts').select('user_id, product_id').in('product_id', productIds),
  ]);
  const byUser = new Map<string, Set<string>>();
  const watchOnly = new Set<string>();
  for (const it of (items ?? []) as unknown as Array<{ product_id: string; baskets: { user_id: string } | { user_id: string }[] }>) {
    const b = Array.isArray(it.baskets) ? it.baskets[0] : it.baskets;
    if (!b?.user_id) continue;
    byUser.set(b.user_id, (byUser.get(b.user_id) ?? new Set()).add(it.product_id));
  }
  for (const w of (watched ?? []) as Array<{ user_id: string; product_id: string }>) {
    if (!byUser.has(w.user_id)) watchOnly.add(w.user_id);
    byUser.set(w.user_id, (byUser.get(w.user_id) ?? new Set()).add(w.product_id));
  }
  const userIds = [...byUser.keys()];
  if (!userIds.length) return { users: 0, sent: 0, preview: [] };

  const [{ data: profiles }, { data: tokens }, { data: recentLog }] = await Promise.all([
    db.from('profiles').select('user_id, plan, plan_expires_at, blocked, digest_enabled, lang').in('user_id', userIds),
    db.from('push_tokens').select('user_id, token').in('user_id', userIds),
    db.from('price_alert_log').select('user_id, product_id, store_id').in('user_id', userIds).gte('sent_at', new Date(Date.now() - 24 * 3600000).toISOString()),
  ]);
  const already = new Set((recentLog ?? []).map((r) => `${r.user_id}|${r.product_id}|${r.store_id}`));
  const tokensBy = new Map<string, string[]>();
  for (const t of tokens ?? []) if (t.user_id) tokensBy.set(t.user_id, [...(tokensBy.get(t.user_id) ?? []), t.token]);

  const messages: Array<{ to: string; title: string; body: string; sound: string; channelId: string; data: unknown }> = [];
  const logs: Array<{ user_id: string; product_id: string; store_id: string; new_price: number }> = [];
  const preview: Array<{ user_id: string; body: string }> = [];
  for (const uid of userIds) {
    const p = (profiles ?? []).find((x) => x.user_id === uid);
    if (!p || p.blocked || p.digest_enabled === false) continue;
    if (settings.plus_only && !isPlus(p)) continue;
    const mine = byUser.get(uid) ?? new Set();
    const fresh = drops.filter((d) => mine.has(d.product_id) && !already.has(`${uid}|${d.product_id}|${d.store_id}`));
    if (!fresh.length) continue;
    const c = copy(langOf(p));
    const lines = fresh.slice(0, 3).map((d) => c.line(`${d.brand} ${d.name}`.trim(), d.store_name, Number(d.old_price).toFixed(2), Number(d.new_price).toFixed(2)));
    const title = fresh.length === 1 ? c.dropOne(`${fresh[0].brand} ${fresh[0].name}`.trim()) : watchOnly.has(uid) ? c.watchMany(fresh.length) : c.dropMany(fresh.length);
    const body = lines.join('\n') + (fresh.length > 3 ? `\n${c.more(fresh.length - 3)}` : '');
    // One drop opens that product; several open the deals list.
    const url = fresh.length === 1 ? `/product/${fresh[0].product_id}` : '/deals';
    preview.push({ user_id: uid, body: `${title}\n${body}` });
    for (const d of fresh) logs.push({ user_id: uid, product_id: d.product_id, store_id: d.store_id, new_price: Number(d.new_price) });
    for (const to of tokensBy.get(uid) ?? []) messages.push({ to, title, body, sound: 'default', channelId: 'price-drops', data: { url } });
  }
  if (opts.dryRun) return { users: preview.length, sent: 0, preview };

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) });
    const j = (await res.json().catch(() => ({}))) as { data?: Array<{ status: string }> };
    sent += (j.data ?? []).filter((t) => t.status === 'ok').length;
  }
  if (logs.length) await db.from('price_alert_log').insert(logs);
  return { users: preview.length, sent, preview };
}
