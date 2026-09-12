import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { Branch, Store } from '@/data/products';

/**
 * Which stores the comparison should consider.
 *
 * Someone in Sumqayıt has no use for a chain that only trades in Baku, and a
 * ranking that keeps naming it as cheapest is noise. Two filters: a chosen
 * set of stores, and "only stores with a branch within N km" — the second one
 * needs the location and stays inert without it.
 *
 * The device is the source of truth. The profile's `favorite_stores` column
 * receives a copy for the record, but is never read back as a filter: it has
 * carried a four-store default since the first migration, and reading it
 * would silently hide every store added since for every existing account.
 */
export interface StorePrefs {
  /** Store ids to keep; null means every store. */
  favorites: string[] | null;
  nearbyOnly: boolean;
  radiusKm: number;
}

const KEY = 'cb_store_prefs';
export const DEFAULT_PREFS: StorePrefs = { favorites: null, nearbyOnly: false, radiusKm: 3 };

let current: StorePrefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<(p: StorePrefs) => void>();

async function load(): Promise<StorePrefs> {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<StorePrefs>;
      current = {
        favorites: Array.isArray(p.favorites) && p.favorites.length ? p.favorites.filter((x): x is string => typeof x === 'string') : null,
        nearbyOnly: !!p.nearbyOnly,
        radiusKm: [2, 3, 5, 10].includes(Number(p.radiusKm)) ? Number(p.radiusKm) : 3,
      };
    }
  } catch {
    /* defaults */
  }
  loaded = true;
  for (const fn of listeners) fn(current);
  return current;
}

export function getStorePrefs(): StorePrefs {
  return current;
}

export function setStorePrefs(patch: Partial<StorePrefs>): StorePrefs {
  current = { ...current, ...patch };
  if (current.favorites && current.favorites.length === 0) current.favorites = null;
  for (const fn of listeners) fn(current);
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
  return current;
}

export function useStorePrefs(): StorePrefs {
  const [p, setP] = useState<StorePrefs>(current);
  useEffect(() => {
    listeners.add(setP);
    load().then(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}

/**
 * The stores left after the preferences. A filter that would leave nothing
 * is ignored rather than honoured: an empty comparison helps nobody, and the
 * screen says how many stores were set aside so the setting is not a mystery.
 */
export function applyStorePrefs(stores: Store[], branches: Branch[], prefs: StorePrefs, locationKnown: boolean): { stores: Store[]; hidden: number } {
  let out = stores;
  if (prefs.favorites) {
    const keep = new Set(prefs.favorites);
    const picked = out.filter((s) => keep.has(s.id));
    if (picked.length) out = picked;
  }
  if (prefs.nearbyOnly && locationKnown) {
    const near = new Set(branches.filter((b) => b.distanceKm <= prefs.radiusKm).map((b) => b.storeId));
    const picked = out.filter((s) => near.has(s.id));
    if (picked.length) out = picked;
  }
  return { stores: out, hidden: stores.length - out.length };
}
