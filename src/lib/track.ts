import { Platform } from 'react-native';
import { supabase } from './supabase';

export type EventKind =
  | 'app_open'
  | 'search'
  | 'scan'
  | 'photo'
  | 'basket_add'
  | 'compare'
  | 'map_open'
  | 'promo'
  | 'suggest'
  | 'share'
  // The subscription funnel: the paywall opened, a plan tapped, the store
  // sheet confirmed by our server, or the attempt lost along the way. Without
  // the last three "how many of the people who saw Plus bought it" is a
  // question nobody can answer.
  | 'plus_view'
  | 'plus_buy'
  | 'plus_purchase'
  | 'plus_restore'
  | 'plus_fail';

let opened = false;

/** Fire-and-forget usage event for the admin analytics. Never throws, never blocks the UI. */
export function track(kind: EventKind, meta: Record<string, unknown> = {}) {
  if (!supabase) return;
  if (kind === 'app_open') {
    if (opened) return;
    opened = true;
  }
  const db = supabase;
  db.auth
    .getSession()
    .then(({ data }) => db.from('events').insert({ user_id: data.session?.user.id ?? null, kind, meta: { ...meta, platform: Platform.OS } }))
    .then(() => undefined, () => undefined);
}
