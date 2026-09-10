import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Banner, Branch, Category, Product, Store } from '@/data/products';

/**
 * The last catalogue the app saw, kept on the phone.
 *
 * Every launch used to be a cold network fetch: nothing at all on screen until
 * Supabase answered, and an empty app on a bad connection — in a shop, in the
 * metro, exactly where the prices are wanted. The snapshot is written whenever a
 * source lands and read back before the network is asked, so the second launch
 * paints immediately and the request that follows only replaces it.
 */

const KEY = 'cb_catalog_v2';
/** Older than this and the prices are too far gone to show even as a placeholder. */
const MAX_AGE_MS = 7 * 86400000;

export interface CatalogSnapshot {
  stores: Store[];
  products: Product[];
  branches: Branch[];
  banners: Banner[];
  categories: Category[];
  /** Epoch millis of the write, used to age `updatedMinutesAgo` on the way back. */
  savedAt: number;
}

type Patch = Partial<Omit<CatalogSnapshot, 'savedAt'>>;

/**
 * The web build stores this in localStorage, which is a few megabytes shared
 * with everything else the origin keeps — a catalogue of a few thousand products
 * would evict the session before it helped anyone.
 */
const enabled = Platform.OS !== 'web';

const EMPTY: CatalogSnapshot = { stores: [], products: [], branches: [], banners: [], categories: [], savedAt: 0 };

/**
 * The snapshot as it stands, merged in memory rather than re-read from disk on
 * every write. Two flushes overlapping would otherwise both read the pre-write
 * state and the second would erase the first one's source.
 */
let snapshot: CatalogSnapshot | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const next = snapshot;
  if (!next) return;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Android's default AsyncStorage is a 6 MB SQLite window. A catalogue that
    // does not fit is dropped in favour of the small lists, which are what the
    // home screen needs first anyway; the products come from the network.
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...next, products: [] })).catch(() => undefined);
  }
}

async function read(): Promise<CatalogSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CatalogSnapshot) : null;
  } catch {
    return null;
  }
}

/** Merges one source into the snapshot; several arrivals coalesce into one write. */
export function cacheCatalog(patch: Patch): void {
  if (!enabled) return;
  snapshot = { ...(snapshot ?? EMPTY), ...patch, savedAt: Date.now() };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), 900);
}

/**
 * The stored catalogue, or null when there is none or it is too old.
 *
 * `updatedMinutesAgo` is a distance from the moment of the fetch, so it is
 * advanced by however long the snapshot sat on disk. Without that a week-old
 * price would still claim it was checked two minutes ago — the freshness dot
 * would be lying, which is worse than not showing one.
 */
export async function readCatalogCache(): Promise<CatalogSnapshot | null> {
  if (!enabled) return null;
  const snap = snapshot ?? (await read());
  if (!snap?.savedAt) return null;
  const ageMs = Date.now() - snap.savedAt;
  if (ageMs > MAX_AGE_MS || ageMs < 0) return null;
  const ageMin = Math.round(ageMs / 60000);
  const aged: CatalogSnapshot = {
    ...snap,
    stores: snap.stores ?? [],
    branches: snap.branches ?? [],
    banners: snap.banners ?? [],
    categories: snap.categories ?? [],
    products: (snap.products ?? []).map((p) => ({ ...p, updatedMinutesAgo: (p.updatedMinutesAgo ?? 0) + ageMin })),
    savedAt: Date.now(),
  };
  // The aged copy is what stays in memory, not the one read off disk. A later
  // write re-stamps `savedAt`, and carrying the original ages across that stamp
  // would quietly reset the clock — a week-old price would go back to claiming
  // it was checked minutes ago, which is exactly what the freshness line on the
  // basket and comparison screens is there to prevent.
  snapshot = aged;
  return aged;
}

export async function clearCatalogCache(): Promise<void> {
  snapshot = null;
  if (timer) clearTimeout(timer);
  timer = null;
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
