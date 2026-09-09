import { Product, Branch, Banner, Category, Store, StoreId, LatLng, withDistances } from '@/data/products';
import { supabase } from './supabase';
import { tr } from './i18n';

interface BranchRow {
  id: string;
  store_id: string;
  name: string;
  address: string;
  lat: number | string | null;
  lng: number | string | null;
  open_until: string | null;
  maps_url: string | null;
  phone: string | null;
  open_from: string | null;
  always_open: boolean | null;
}

interface ProductPriceRow {
  id: string;
  barcode: string | null;
  name: string;
  brand: string;
  size: string;
  category: string;
  emoji: string | null;
  tint: string | null;
  image_url: string | null;
  rating: number | null;
  prices: Record<string, number | null> | null;
  regular_prices?: Record<string, number | null> | null;
  discount_ends?: Record<string, string | null> | null;
  discount_starts?: Record<string, string | null> | null;
  updated_at: string | null;
}

const need = () => {
  if (!supabase) throw new Error(tr('common.notConfigured'));
  return supabase;
};

/**
 * Reads every row of a query, a page at a time.
 *
 * PostgREST caps a response at the project's `db-max-rows` (1000 on Supabase by
 * default) and says nothing when it truncates — the list simply stops. Without
 * this the app saw only the first 1000 products by name: everything after them
 * was unsearchable, absent from categories and invisible to the barcode
 * scanner, while the admin panel (which already paginates) showed the full
 * catalogue.
 */
async function fetchPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  page = 1000,
): Promise<T[]> {
  const first = await build(0, page - 1);
  if (first.error) throw first.error;
  const head = first.data ?? [];
  if (head.length < page) return head;

  // Past the first page the rest are fetched together rather than one after
  // another. A catalogue of a few thousand products was several round trips
  // deep, and on a phone connection that is most of the wait before the app can
  // show anything. They go out in waves so a large catalogue does not open
  // dozens of connections at once.
  const WAVE = 4;
  const out = [...head];
  for (let base = page; ; base += page * WAVE) {
    const wave = await Promise.all(
      Array.from({ length: WAVE }, (_, i) => build(base + i * page, base + (i + 1) * page - 1)),
    );
    for (const r of wave) {
      if (r.error) throw r.error;
      out.push(...(r.data ?? []));
    }
    // A short page is the end of the table; anything past it is empty.
    if (wave.some((r) => (r.data ?? []).length < page)) return out;
  }
}


function rowToProduct(r: ProductPriceRow, history: number[] = []): Product {
  const prices: Record<StoreId, number | null> = {};
  for (const [k, v] of Object.entries(r.prices ?? {})) prices[k] = v == null ? null : Number(v);
  const regularPrices: Record<StoreId, number> = {};
  for (const [k, v] of Object.entries(r.regular_prices ?? {})) if (v != null && prices[k] != null && Number(v) > (prices[k] as number)) regularPrices[k] = Number(v);
  const discountEnds: Record<StoreId, string> = {};
  for (const [k, v] of Object.entries(r.discount_ends ?? {})) if (v) discountEnds[k] = v;
  const discountStarts: Record<StoreId, string> = {};
  for (const [k, v] of Object.entries(r.discount_starts ?? {})) if (v) discountStarts[k] = v;
  const updatedMinutesAgo = r.updated_at ? Math.max(0, Math.round((Date.now() - new Date(r.updated_at).getTime()) / 60000)) : 0;
  return {
    id: r.id,
    barcode: r.barcode ?? '',
    name: r.name,
    brand: r.brand,
    size: r.size,
    category: r.category,
    emoji: r.emoji ?? '🛒',
    tint: r.tint ?? '#F3F4F6',
    imageUrl: r.image_url,
    prices,
    regularPrices,
    discountEnds: Object.keys(discountEnds).length ? discountEnds : undefined,
    discountStarts: Object.keys(discountStarts).length ? discountStarts : undefined,
    history,
    updatedMinutesAgo,
    rating: r.rating ?? undefined,
  };
}

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await need().from('stores').select('id, name, color, initial, logo_url, open_from, open_until, always_open').order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color ?? '#6B7280',
    initial: s.initial ?? s.name.slice(0, 1),
    logo_url: s.logo_url ?? null,
    openFrom: s.open_from ?? null,
    openUntil: s.open_until ?? null,
    alwaysOpen: !!s.always_open,
  }));
}

export async function fetchProducts(): Promise<Product[]> {
  const db = need();
  const rows = await fetchPaged<ProductPriceRow>((from, to) => db.from('product_prices').select('*').order('name').range(from, to));
  // Products without a single price are kept in the admin catalogue but hidden from shoppers.
  return rows.map((r) => rowToProduct(r)).filter((p) => Object.values(p.prices).some((v) => v != null));
}

export async function fetchProduct(id: string): Promise<Product | undefined> {
  const db = need();
  const [{ data: row }, { data: hist }] = await Promise.all([
    db.from('product_prices').select('*').eq('id', id).maybeSingle(),
    db.from('price_history').select('price, recorded_at').eq('product_id', id).order('recorded_at', { ascending: true }).limit(30),
  ]);
  if (!row) return undefined;
  return rowToProduct(row as ProductPriceRow, (hist ?? []).map((h) => Number(h.price)));
}

export async function fetchPriceHistory(productId: string, storeId: string): Promise<number[]> {
  const { data } = await need().from('price_history').select('price').eq('product_id', productId).eq('store_id', storeId).order('recorded_at', { ascending: true }).limit(30);
  return (data ?? []).map((h) => Number(h.price));
}

export async function fetchByBarcode(code: string): Promise<Product | undefined> {
  const { data } = await need().from('product_prices').select('*').eq('barcode', code).maybeSingle();
  return data ? rowToProduct(data as ProductPriceRow) : undefined;
}

export async function fetchBranches(from: LatLng): Promise<Branch[]> {
  const db = need();
  const data = await fetchPaged<BranchRow>((a, b) => db.from('branches').select('*').range(a, b));
  // A branch entered as a name only has no coordinates until its Google Maps
  // link is added in the admin panel. It is left out rather than pinned at
  // 0°,0°, which would put it in the Atlantic and let it win "nearest branch"
  // for anyone the distance maths happened to favour.
  const located = data.filter((b) => b.lat != null && b.lng != null && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)));
  const raw: Branch[] = located.map((b) => ({
    id: b.id,
    storeId: b.store_id,
    name: b.name,
    address: b.address,
    lat: Number(b.lat),
    lng: Number(b.lng),
    openUntil: b.open_until ?? '',
    mapsUrl: b.maps_url ?? null,
    phone: b.phone ?? null,
    openFrom: b.open_from ?? null,
    alwaysOpen: !!b.always_open,
    distanceKm: 0,
    walkMinutes: 0,
  }));
  return withDistances(raw, from);
}

/** Active promo banners for the home slider (RLS already filters by active + dates). */
export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await need().from('banners').select('id, title, subtitle, image_url, bg_color, text_color, link').order('sort');
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle ?? null,
    imageUrl: b.image_url ?? null,
    bgColor: b.bg_color ?? '#E53935',
    textColor: b.text_color ?? '#FFFFFF',
    link: b.link ?? null,
  }));
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await need().from('categories').select('id, name, emoji').order('sort');
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, emoji: c.emoji ?? null }));
}
