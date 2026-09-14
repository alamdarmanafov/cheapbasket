import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'cb_budget';
const RANK_KEY = 'cb_rank_mode';

let current: number | null = null;
let loaded = false;
const listeners = new Set<(v: number | null) => void>();

async function load(): Promise<number | null> {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw == null ? NaN : Number(raw);
    current = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    current = null;
  }
  loaded = true;
  return current;
}

/** The basket's spending limit for this device, in manat; null when none is set. */
export function setBudget(value: number | null): void {
  current = value != null && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  loaded = true;
  listeners.forEach((l) => l(current));
  (current == null ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, String(current))).catch(() => undefined);
}

export function useBudget(): number | null {
  const [v, setV] = useState<number | null>(current);
  useEffect(() => {
    listeners.add(setV);
    load().then(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

export type RankMode = 'cheap' | 'near';

/** How the comparison orders stores: by price (default) or by distance. Remembered per device. */
export function useRankMode(): [RankMode, (m: RankMode) => void] {
  const [mode, setMode] = useState<RankMode>('cheap');
  useEffect(() => {
    AsyncStorage.getItem(RANK_KEY)
      .then((v) => v === 'near' && setMode('near'))
      .catch(() => undefined);
  }, []);
  const set = (m: RankMode) => {
    setMode(m);
    AsyncStorage.setItem(RANK_KEY, m).catch(() => undefined);
  };
  return [mode, set];
}
