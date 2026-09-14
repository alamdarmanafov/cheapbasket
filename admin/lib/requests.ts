import { adminDb } from './server';
import { copy, langOf } from './pushCopy';
import { EXPO_PUSH_URL, PUSH_CHANNEL, PUSH_SOUND } from './push';

interface Settings { max_per_user_per_day: number; push_per_request: number; push_per_user_per_run: number }

/**
 * "What does this cost at Bravo?" — put to the people who shop at Bravo.
 *
 * An open request that has not been sent yet goes to shoppers with a trip or
 * a price report at that store in the last 90 days (never the asker), a
 * handful per request and a few per person per run so nobody is spammed. The
 * answer comes back as an ordinary price report: the admin applies it, or
 * two matching answers apply it between them, exactly as before. The request
 * is marked answered by trigger when a priced report for that product and
 * store lands.
 */
export async function notifyRequests(opts: { dryRun?: boolean } = {}) {
  const db = adminDb();
  const { data: setting } = await db.from('app_settings').select('value').eq('key', 'requests').maybeSingle();
  const cfg: Settings = { max_per_user_per_day: 5, push_per_request: 30, push_per_user_per_run: 3, ...((setting?.value as Partial<Settings> | null) ?? {}) };
  const { data: pts } = await db.from('app_settings').select('value').eq('key', 'points').maybeSingle();
  const points = Number((pts?.value as { price_report?: number } | null)?.price_report ?? 2);

  const { data: open } = await db
    .from('price_requests')
    .select('id, product_id, store_id, user_id, products(name, brand, size), stores(name)')
    .eq('status', 'open')
    .is('notified_at', null)
    .order('created_at')
    .limit(50);
  const requests = (open ?? []) as unknown as Array<{ id: string; product_id: string; store_id: string; user_id: string; products: { name: string; brand: string; size: string } | null; stores: { name: string } | null }>;
  if (!requests.length) return { requests: 0, pushes: 0 };

  const since = new Date(Date.now() - 90 * 86400000).toISOString();
  const storeIds = [...new Set(requests.map((r) => r.store_id))];
  const [{ data: trips }, { data: reports }] = await Promise.all([
    db.from('trips').select('user_id, store_id').in('store_id', storeIds).gte('created_at', since),
    db.from('price_reports').select('user_id, store_id').in('store_id', storeIds).gte('created_at', since),
  ]);
  const shoppers = new Map<string, Set<string>>();
  for (const r of [...(trips ?? []), ...(reports ?? [])] as Array<{ user_id: string; store_id: string }>) {
    const set = shoppers.get(r.store_id) ?? new Set<string>();
    set.add(r.user_id);
    shoppers.set(r.store_id, set);
  }
  const allUsers = [...new Set([...shoppers.values()].flatMap((s) => [...s]))];
  const [{ data: tokens }, { data: profiles }] = allUsers.length
    ? await Promise.all([db.from('push_tokens').select('user_id, token').in('user_id', allUsers), db.from('profiles').select('user_id, lang').in('user_id', allUsers)])
    : [{ data: [] }, { data: [] }];
  const tokensOf = new Map<string, string[]>();
  for (const t of (tokens ?? []) as Array<{ user_id: string; token: string }>) tokensOf.set(t.user_id, [...(tokensOf.get(t.user_id) ?? []), t.token]);
  const langOfUser = new Map((profiles ?? []).map((p: { user_id: string; lang: string | null }) => [p.user_id, langOf(p)]));

  const sentTo = new Map<string, number>();
  const messages: Array<Record<string, unknown>> = [];
  const done: Array<{ id: string; notified: number }> = [];
  for (const r of requests) {
    const candidates = [...(shoppers.get(r.store_id) ?? [])].filter((u) => u !== r.user_id && (tokensOf.get(u) ?? []).length && (sentTo.get(u) ?? 0) < cfg.push_per_user_per_run);
    // Newest shoppers are not favoured over old ones: shuffle so the same
    // thirty people are not asked every time.
    candidates.sort(() => Math.random() - 0.5);
    const picked = candidates.slice(0, cfg.push_per_request);
    const name = r.products ? `${r.products.brand} ${r.products.name} ${r.products.size}`.trim() : r.product_id;
    const storeName = r.stores?.name ?? r.store_id;
    for (const u of picked) {
      const c = copy(langOfUser.get(u) ?? 'az');
      for (const token of tokensOf.get(u) ?? []) {
        messages.push({ to: token, title: c.askTitle(storeName), body: c.askBody(name, points), sound: PUSH_SOUND, channelId: PUSH_CHANNEL, data: { url: `/product/${r.product_id}?ask=${r.store_id}` } });
      }
      sentTo.set(u, (sentTo.get(u) ?? 0) + 1);
    }
    done.push({ id: r.id, notified: picked.length });
  }
  if (!opts.dryRun) {
    for (let i = 0; i < messages.length; i += 100) {
      await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(messages.slice(i, i + 100)) }).catch(() => undefined);
    }
    const now = new Date().toISOString();
    for (const d of done) await db.from('price_requests').update({ notified_at: now, notified: d.notified }).eq('id', d.id);
  }
  return { requests: done.length, pushes: messages.length, dryRun: !!opts.dryRun };
}
