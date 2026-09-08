import { Product, Branch, Banner, Category, Store, StoreId, LatLng, withDistances } from '@/data/products';
import { supabase } from './supabase';

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
  if (!supabase) throw new Error('Supabase konfiqurasiya olunmayıb');
  return supabase;
};

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
  const { data, error } = await need().from('stores').select('id, name, color, initial, logo_url').order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color ?? '#6B7280', initial: s.initial ?? s.name.slice(0, 1), logo_url: s.logo_url ?? null }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await need().from('product_prices').select('*').order('name');
  if (error) throw error;
  // Products without a single price are kept in the admin catalogue but hidden from shoppers.
  return ((data ?? []) as ProductPriceRow[]).map((r) => rowToProduct(r)).filter((p) => Object.values(p.prices).some((v) => v != null));
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
  const { data, error } = await need().from('branches').select('*');
  if (error) throw error;
  const raw: Branch[] = (data ?? []).map((b) => ({
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
