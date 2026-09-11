import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { celebrate } from './celebrate';
import { tr, activeLang } from './i18n';

/**
 * The part of a reward the user actually sees.
 *
 * An approved suggestion pays out while the app is closed — the admin presses
 * the button hours later — so nothing on the device knows it happened. This
 * runs whenever the profile loads: it asks the server to turn any balance that
 * clears a tier into Plus, then looks for suggestion credits it has not shown
 * yet, and fires one celebration for whatever it found. The same confetti as a
 * purchase, because to the person holding the phone it is the same news.
 */

export const REWARDS_SEEN_KEY = 'cb_rewards_seen';
const SEEN_KEY = REWARDS_SEEN_KEY;

interface Redeemed { days: number; cost: number; expires_at: string }

/** Returns true when the profile changed on the server and should be re-read. */
export async function checkRewards(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const db = supabase;

  let seen: string | null = null;
  try {
    seen = await AsyncStorage.getItem(SEEN_KEY);
  } catch {
    /* no stored marker: treated as a fresh install below */
  }

  const [{ data: redeemedRaw }, { data: rows }] = await Promise.all([
    db.rpc('auto_redeem_points'),
    db
      .from('points_ledger')
      .select('delta, created_at')
      .eq('user_id', userId)
      .eq('reason', 'suggestion')
      .gt('created_at', seen ?? new Date(0).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const now = new Date().toISOString();
  AsyncStorage.setItem(SEEN_KEY, now).catch(() => undefined);

  const redeemed = (redeemedRaw ?? null) as Redeemed | null;
  // A first run has no marker, and celebrating every credit in the account's
  // history would be noise. The marker is set above; from here on only new
  // credits count.
  const credits = seen ? (rows ?? []) : [];
  const points = credits.reduce((a, r) => a + Number(r.delta), 0);

  if (points > 0 || redeemed?.days) {
    const title = points > 0 ? tr('points.earnedTitle', { points }) : tr('points.plusTitle');
    const body = redeemed?.days
      ? tr('points.plusBody', { days: redeemed.days, date: new Date(redeemed.expires_at).toLocaleDateString(activeLang()) })
      : tr('points.earnedBody', { count: credits.length });
    celebrate(title, body);
  }
  return !!redeemed?.days;
}
