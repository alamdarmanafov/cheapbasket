import { adminDb } from './server';

import { type Segment } from './segments.shared';
export { SEGMENTS, type Segment } from './segments.shared';

const isPlus = (p: { plan?: string | null; plan_expires_at?: string | null }) => p.plan === 'plus' && (!p.plan_expires_at || new Date(p.plan_expires_at) > new Date());

/** Push tokens of the users in a segment (blocked users excluded). */
export async function segmentTokens(segment: Segment, city?: string): Promise<{ tokens: string[]; users: number }> {
  const db = adminDb();
  const { data: tokens } = await db.from('push_tokens').select('user_id, token');
  const all = tokens ?? [];
  const userIds = [...new Set(all.map((t) => t.user_id).filter((x): x is string => !!x))];
  const { data: profiles } = userIds.length ? await db.from('profiles').select('user_id, plan, plan_expires_at, blocked, city').in('user_id', userIds) : { data: [] };
  const prof = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  let allowed = new Set(userIds.filter((id) => !prof.get(id)?.blocked));

  if (segment === 'plus') allowed = new Set([...allowed].filter((id) => isPlus(prof.get(id) ?? {})));
  if (segment === 'free') allowed = new Set([...allowed].filter((id) => !isPlus(prof.get(id) ?? {})));
  if (segment === 'city') { const c = (city ?? '').trim().toLowerCase(); allowed = new Set([...allowed].filter((id) => (prof.get(id)?.city ?? '').trim().toLowerCase() === c)); }
  if (segment === 'basket' || segment === 'no_basket') {
    const { data: items } = await db.from('basket_items').select('baskets!inner(user_id)');
    const withBasket = new Set(((items ?? []) as unknown as Array<{ baskets: { user_id: string } | { user_id: string }[] }>).map((i) => (Array.isArray(i.baskets) ? i.baskets[0]?.user_id : i.baskets?.user_id)).filter(Boolean));
    allowed = new Set([...allowed].filter((id) => (segment === 'basket' ? withBasket.has(id) : !withBasket.has(id))));
  }
  if (segment === 'inactive7') {
    const { data: usersRaw } = await db.rpc('admin_users_list').select('id, last_sign_in_at');
    const users = (Array.isArray(usersRaw) ? usersRaw : usersRaw ? [usersRaw] : []) as Array<{ id: string; last_sign_in_at: string | null }>;
    const cutoff = Date.now() - 7 * 86400000;
    const inactive = new Set(users.filter((u) => !u.last_sign_in_at || new Date(u.last_sign_in_at).getTime() < cutoff).map((u) => u.id));
    allowed = new Set([...allowed].filter((id) => inactive.has(id)));
  }
  // Anonymous tokens (no user id) only in "all".
  const list = all.filter((t) => (t.user_id ? allowed.has(t.user_id) : segment === 'all')).map((t) => t.token as string);
  return { tokens: [...new Set(list)], users: allowed.size };
}
