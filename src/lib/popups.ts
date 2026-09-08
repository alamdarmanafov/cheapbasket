import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Lang } from './translations';

/** Admin-authored copy for one non-Azerbaijani language; any field may be missing. */
interface Translation {
  title?: string;
  body?: string;
  cta_label?: string;
}

export interface Popup {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaLink: string | null;
  audience: 'all' | 'free' | 'plus';
  maxPerDay: number;
  maxPerWeek: number;
  /** Non-Azerbaijani copy keyed by language code — the base fields stay Azerbaijani. */
  translations: Partial<Record<Lang, Translation>>;
}

interface PopupRow {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  audience: string;
  max_per_day: number;
  max_per_week: number;
  translations: Partial<Record<Lang, Translation>> | null;
}

const LOG_KEY = 'cb_popup_views';
const DAY = 86400000;

/** popup id → timestamps it was shown at. Trimmed to the last week on write. */
type ViewLog = Record<string, number[]>;

export async function readLog(): Promise<ViewLog> {
  try {
    const raw = await AsyncStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as ViewLog) : {};
  } catch {
    return {};
  }
}

/** Records one impression and drops anything older than a week, so the log cannot grow. */
export async function recordView(id: string): Promise<void> {
  const log = await readLog();
  const cutoff = Date.now() - 7 * DAY;
  const next: ViewLog = {};
  for (const [k, times] of Object.entries(log)) {
    const kept = times.filter((t) => t > cutoff);
    if (kept.length) next[k] = kept;
  }
  next[id] = [...(next[id] ?? []), Date.now()];
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next)).catch(() => undefined);
}

/** RLS already limits this to active popups inside their date window. */
export async function fetchPopups(): Promise<Popup[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('popups')
    .select('id, title, body, image_url, cta_label, cta_link, audience, max_per_day, max_per_week, translations')
    .order('sort');
  if (error) return [];
  return (data as PopupRow[] | null ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    imageUrl: r.image_url,
    ctaLabel: r.cta_label,
    ctaLink: r.cta_link,
    audience: r.audience === 'free' || r.audience === 'plus' ? r.audience : 'all',
    maxPerDay: r.max_per_day ?? 0,
    maxPerWeek: r.max_per_week ?? 0,
    translations: r.translations ?? {},
  }));
}

/**
 * First popup this user is still allowed to see, or null.
 * A limit of 0 means "no cap for that window".
 */
export function pickPopup(popups: Popup[], isPlus: boolean, log: ViewLog): Popup | null {
  const now = Date.now();
  for (const p of popups) {
    if (p.audience === 'free' && isPlus) continue;
    if (p.audience === 'plus' && !isPlus) continue;
    const times = log[p.id] ?? [];
    if (p.maxPerDay > 0 && times.filter((t) => t > now - DAY).length >= p.maxPerDay) continue;
    if (p.maxPerWeek > 0 && times.filter((t) => t > now - 7 * DAY).length >= p.maxPerWeek) continue;
    return p;
  }
  return null;
}

/**
 * The popup as one language should read it. Azerbaijani is the authored source,
 * so any field the admin left untranslated falls back to it rather than to an
 * empty string — a half-translated announcement still says something.
 */
export function localize(p: Popup, lang: Lang): Popup {
  if (lang === 'az') return p;
  const t = p.translations?.[lang];
  if (!t) return p;
  return {
    ...p,
    title: t.title?.trim() || p.title,
    body: t.body?.trim() || p.body,
    ctaLabel: t.cta_label?.trim() || p.ctaLabel,
  };
}
