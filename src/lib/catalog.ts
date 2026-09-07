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
    history,
    updatedMinutesAgo,
    rating: r.rating ?? undefined,
  };
}

export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await need().from('stores').select('id, name, color, initial').order('name');
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, color: s.color ?? '#6B7280', initial: s.initial ?? s.name.slice(0, 1) }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await need().from('product_prices').select('*').order('name');
  if (error) throw error;
  return ((data ?? []) as ProductPriceRow[]).map((r) => rowToProduct(r));
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
