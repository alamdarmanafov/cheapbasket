import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Short per-device lists of what was searched and scanned last. The weekly
 * shop repeats — milk, eggs, bread — and eight chips beat typing them again.
 * Newest first, no duplicates, capped so the list never grows.
 */
export const RECENT_SEARCHES = 'cb_recent_searches';
export const RECENT_SCANS = 'cb_recent_scans';
const MAX = 8;

export async function readRecents(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function pushRecent(key: string, value: string): Promise<string[]> {
  const v = value.trim();
  if (!v) return readRecents(key);
  const next = [v, ...(await readRecents(key)).filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, MAX);
  AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => undefined);
  return next;
}

export async function clearRecents(key: string): Promise<void> {
  await AsyncStorage.removeItem(key).catch(() => undefined);
}
