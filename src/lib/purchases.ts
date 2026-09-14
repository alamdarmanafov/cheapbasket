import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Product, catalog } from '@/data/products';
import { tr } from './i18n';

const KEY = 'cb_purchases';
const REMINDER_ID = 'repeat-reminder';
const KEEP = 6;

type Log = Record<string, string[]>; // product id → ISO dates, newest last

async function read(): Promise<Log> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Log) : {};
  } catch {
    return {};
  }
}

/**
 * What was bought, when, on this device only.
 *
 * Shopping rhythm is a private thing and a small one: the last six dates per
 * product are enough to say "milk every five days". Nothing leaves the phone.
 */
export async function recordPurchases(productIds: string[]): Promise<void> {
  if (!productIds.length) return;
  const log = await read();
  const now = new Date().toISOString();
  for (const id of productIds) {
    const dates = log[id] ?? [];
    // One trip a day per product: ticking twice is not buying twice.
    if (dates.length && dates[dates.length - 1].slice(0, 10) === now.slice(0, 10)) continue;
    log[id] = [...dates, now].slice(-KEEP);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(log)).catch(() => undefined);
  await scheduleReminder(log).catch(() => undefined);
}

export interface DueProduct { product: Product; intervalDays: number; overdueDays: number }

/** The usual gap between purchases, in days, from at least two dates. */
function intervalOf(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) gaps.push((new Date(dates[i]).getTime() - new Date(dates[i - 1]).getTime()) / 86400000);
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return median >= 1 ? median : null;
}

/** Products whose usual gap has (nearly) run out, most overdue first. */
export async function dueProducts(exclude: Set<string> = new Set()): Promise<DueProduct[]> {
  const log = await read();
  const out: DueProduct[] = [];
  const now = Date.now();
  for (const [id, dates] of Object.entries(log)) {
    if (exclude.has(id)) continue;
    const interval = intervalOf(dates);
    if (!interval) continue;
    const product = catalog.products.find((p) => p.id === id);
    if (!product) continue;
    const since = (now - new Date(dates[dates.length - 1]).getTime()) / 86400000;
    if (since >= interval * 0.9) out.push({ product, intervalDays: Math.round(interval), overdueDays: Math.round(since - interval) });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}

/** One local notification for the next product that will run out, at 10:00 that day. */
async function scheduleReminder(log: Log): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  let next: { product: Product; at: Date } | null = null;
  for (const [id, dates] of Object.entries(log)) {
    const interval = intervalOf(dates);
    if (!interval) continue;
    const product = catalog.products.find((p) => p.id === id);
    if (!product) continue;
    const at = new Date(new Date(dates[dates.length - 1]).getTime() + interval * 86400000);
    at.setHours(10, 0, 0, 0);
    if (at.getTime() <= Date.now()) continue;
    if (!next || at < next.at) next = { product, at };
  }
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
  if (!next) return;
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: tr('repeat.pushTitle'), body: tr('repeat.pushBody', { name: `${next.product.brand} ${next.product.name}`.trim() }), data: { url: '/' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next.at },
  });
}
