import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface MyStats { scans: number; reports: number; reports_applied: number; trips: number; referrals: number; suggestions: number; weeks: number }
export interface Challenge { done: number; target: number; bonus: number; claimed: boolean; week_ends: string }

export type BadgeId = 'scan1' | 'scan25' | 'scan100' | 'price5' | 'price25' | 'price100' | 'trip5' | 'trip20' | 'friend1' | 'friend5' | 'suggest1' | 'week3';

/**
 * What a badge is for and when it is earned. The counts come from my_stats()
 * (0042); the thresholds live here so the ladder can change without a
 * migration. Names and hints are translation keys `badge.<id>` /
 * `badge.<id>Hint`.
 */
export const BADGES: Array<{ id: BadgeId; emoji: string; stat: keyof MyStats; at: number }> = [
  { id: 'scan1', emoji: '📷', stat: 'scans', at: 1 },
  { id: 'scan25', emoji: '🔍', stat: 'scans', at: 25 },
  { id: 'scan100', emoji: '🛰️', stat: 'scans', at: 100 },
  { id: 'price5', emoji: '🏷️', stat: 'reports', at: 5 },
  { id: 'price25', emoji: '🕵️', stat: 'reports', at: 25 },
  { id: 'price100', emoji: '🏆', stat: 'reports', at: 100 },
  { id: 'trip5', emoji: '🛒', stat: 'trips', at: 5 },
  { id: 'trip20', emoji: '🧭', stat: 'trips', at: 20 },
  { id: 'friend1', emoji: '🤝', stat: 'referrals', at: 1 },
  { id: 'friend5', emoji: '📣', stat: 'referrals', at: 5 },
  { id: 'suggest1', emoji: '💡', stat: 'suggestions', at: 1 },
  { id: 'week3', emoji: '🔥', stat: 'weeks', at: 3 },
];

export function badgeProgress(stats: MyStats | null) {
  return BADGES.map((b) => {
    const have = stats?.[b.stat] ?? 0;
    return { ...b, have, earned: have >= b.at };
  });
}

/** The signed-in person's counts and this week's challenge, refreshed on demand. */
export function useMyStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setStats(null);
      setChallenge(null);
      return;
    }
    const [s, c] = await Promise.all([supabase.rpc('my_stats').maybeSingle(), supabase.rpc('my_challenge').maybeSingle()]);
    if (!s.error && s.data) setStats(s.data as MyStats);
    if (!c.error && c.data) setChallenge(c.data as Challenge);
  }, [userId]);
  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);
  return { stats, challenge, reload: load };
}
