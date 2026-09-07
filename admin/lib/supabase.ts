'use client';

/** Client-side data access: every call goes through /api/db (admin cookie + service role on the server). */
async function call<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error ?? j) || `HTTP ${res.status}`);
  return j as T;
}

export const db = {
  select: <T = any>(table: string, o: { columns?: string; order?: string; eq?: Record<string, unknown>; limit?: number } = {}) =>
    call<{ data: T[] }>({ op: 'select', table, ...o }).then((r) => r.data),
  count: (table: string, eq?: Record<string, unknown>) => call<{ count: number }>({ op: 'count', table, eq }).then((r) => r.count),
  upsert: (table: string, rows: Record<string, unknown>[], onConflict?: string) => call<{ ok: true }>({ op: 'upsert', table, rows, onConflict }),
  delete: (table: string, eq: Record<string, unknown>) => call<{ ok: true }>({ op: 'delete', table, eq }),
};

export interface Store { id: string; name: string; color: string; initial: string }
export interface Product {
  id: string; barcode: string | null; name: string; brand: string; size: string; category: string;
  emoji: string | null; tint: string | null; image_url: string | null; rating: number | null;
}
export interface PriceRow { product_id: string; store_id: string; price: number | null; discount_price: number | null; updated_at: string }
export interface Branch { id: string; store_id: string; name: string; address: string; lat: number; lng: number; open_until: string | null }
export interface AdminUser { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string; display_name: string | null; plan: 'free' | 'plus'; plan_expires_at: string | null; plan_note: string | null; blocked: boolean; city: string | null; devices?: number }

export const CATEGORIES = ['Süd məhsulları', 'Yumurta', 'Qida', 'İçkilər', 'Ət', 'Meyvə-tərəvəz', 'Çörək', 'Şirniyyat', 'Ev və gigiyena'];

export const slugify = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
