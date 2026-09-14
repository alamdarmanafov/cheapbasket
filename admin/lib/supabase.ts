'use client';
import { useEffect, useState } from 'react';

/** Client-side data access: every call goes through /api/db (admin cookie + service role on the server). */
async function call<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error ?? j) || `HTTP ${res.status}`);
  return j as T;
}

const PAGE = 1000;

export const db = {
  /**
   * `fetchAll` pages from here, one request per thousand rows, so no single
   * serverless call has to walk the whole table: with the catalogue past a
   * few thousand products the old server-side loop ran over Vercel's function
   * limit and the page saw a Gateway Timeout instead of the list.
   */
  select: async <T = any>(table: string, o: { columns?: string; order?: string; eq?: Record<string, unknown>; limit?: number; fetchAll?: boolean } = {}): Promise<T[]> => {
    if (!o.fetchAll) return call<{ data: T[] }>({ op: 'select', table, ...o }).then((r) => r.data);
    const { fetchAll: _all, limit: _limit, ...rest } = o;
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await call<{ data: T[] }>({ op: 'select', table, ...rest, range: [from, from + PAGE - 1] });
      out.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  },
  count: (table: string, eq?: Record<string, unknown>) => call<{ count: number }>({ op: 'count', table, eq }).then((r) => r.count),
  upsert: (table: string, rows: Record<string, unknown>[], onConflict?: string) => call<{ ok: true }>({ op: 'upsert', table, rows, onConflict }),
  delete: (table: string, eq: Record<string, unknown>) => call<{ ok: true }>({ op: 'delete', table, eq }),
  /** A database function from the gateway's allowlist. */
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => call<{ data: T }>({ op: 'rpc', fn, args }).then((r) => r.data),
};

export interface Store {
  id: string; name: string; color: string; initial: string; logo_url?: string | null;
  /** Hours for the whole chain; a branch may override with its own values. */
  open_from?: string | null; open_until?: string | null; always_open?: boolean;
  /** Site search with {q} for the words, read by the finder when the store has no feed. */
  search_url?: string | null;
}

/** Announcement popup shown over the app (campaigns, release notes). */
export interface Popup {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  audience: 'all' | 'free' | 'plus';
  max_per_day: number;
  max_per_week: number;
  sort: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  /** Non-Azerbaijani copy, keyed by language code. Blank fields fall back to the base columns. */
  translations: PopupTranslations;
}
export type PopupLang = 'az' | 'en' | 'tr' | 'ru';
export type PopupTranslations = Partial<Record<Exclude<PopupLang, 'az'>, { title?: string; body?: string; cta_label?: string }>>;
/** One row of iap_events: a store purchase, renewal, refund or a restore check. */
export interface IapEvent {
  id: string;
  user_id: string | null;
  platform: 'apple' | 'google' | string;
  event: string;
  product_id: string | null;
  transaction_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Product {
  id: string; barcode: string | null; name: string; brand: string; size: string; category: string;
  emoji: string | null; tint: string | null; image_url: string | null; rating: number | null;
}
export interface PriceRow { product_id: string; store_id: string; price: number | null; discount_price: number | null; discount_starts: string | null; discount_ends: string | null; updated_at: string }
export interface Banner { id: string; title: string; subtitle: string | null; image_url: string | null; bg_color: string | null; text_color: string | null; link: string | null; sort: number; active: boolean; starts_at: string | null; ends_at: string | null }
/** A branch imported as a name only has no coordinates yet — its link supplies them later. */
export interface Branch { id: string; store_id: string; name: string; address: string; lat: number | null; lng: number | null; open_until: string | null; maps_url?: string | null; phone?: string | null; open_from?: string | null }
export interface AdminUser { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string; display_name: string | null; plan: 'free' | 'plus'; plan_expires_at: string | null; plan_note: string | null; blocked: boolean; city: string | null; devices?: number }

/** Fallback list used until the `categories` table has rows. */
export const CATEGORIES = ['Süd məhsulları', 'Yumurta', 'Qida', 'İçkilər', 'Ət', 'Meyvə-tərəvəz', 'Çörək', 'Şirniyyat', 'Ev və gigiyena'];
export interface Category { id: string; name: string; emoji: string | null; sort: number; names?: Partial<Record<'en' | 'tr' | 'ru', string>> | null }

/** Category names from the admin-managed table (ordered), falling back to the built-in list. */
export function useCategories(): { categories: Category[]; names: string[]; reload: () => Promise<void> } {
  const [categories, setCategories] = useState<Category[]>([]);
  const reload = async () => {
    const rows = await db.select<Category>('categories', { order: 'sort' }).catch(() => [] as Category[]);
    setCategories(rows);
  };
  useEffect(() => { reload(); }, []);
  const names = categories.length ? categories.map((c) => c.name) : CATEGORIES;
  return { categories, names, reload };
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
