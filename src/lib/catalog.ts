import { PRODUCTS, BRANCHES, Product, Branch, StoreId, STORE_IDS } from '@/data/products';
import { supabase } from './supabase';

/**
 * Catalog access. Reads from Supabase when EXPO_PUBLIC_SUPABASE_URL /
 * EXPO_PUBLIC_SUPABASE_ANON_KEY are set, otherwise from the bundled mock data,
 * so the prototype always works offline.
 */

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
  prices: Partial<Record<StoreId, number | null>> | null;
  updated_at: string | null;
}

function rowToProduct(r: ProductPriceRow, history: number[] = []): Product {
  const prices = Object.fromEntries(STORE_IDS.map((s) => [s, r.prices?.[s] ?? null])) as Record<StoreId, number | null>;
  const updatedMinutesAgo = r.updated_at ? Math.max(0, Math.round((Date.now() - new Date(r.updated_at).getTime()) / 60000)) : 0;
  return {
    id: r.id,
    barcode: r.barcode ?? '',
    name: r.name,
    brand: r.brand,
    size: r.size,
    category: r.category as Product['category'],
    emoji: r.emoji ?? '🛒',
    tint: r.tint ?? '#F3F4F6',
    prices,
    history: history.length ? history : [],
    updatedMinutesAgo,
    rating: r.rating ?? undefined,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  if (!supabase) return PRODUCTS;
  const { data, error } = await supabase.from('product_prices').select('*').order('name');
  if (error || !data) return PRODUCTS;
  return (data as ProductPriceRow[]).map((r) => rowToProduct(r));
}

export async function fetchProduct(id: string): Promise<Product | undefined> {
  if (!supabase) return PRODUCTS.find((p) => p.id === id);
  const [{ data: row }, { data: hist }] = await Promise.all([
    supabase.from('product_prices').select('*').eq('id', id).maybeSingle(),
    supabase.from('price_history').select('price, recorded_at').eq('product_id', id).order('recorded_at', { ascending: true }).limit(30),
  ]);
  if (!row) return undefined;
  return rowToProduct(row as ProductPriceRow, (hist ?? []).map((h) => Number(h.price)));
}

export async function fetchByBarcode(code: string): Promise<Product | undefined> {
  if (!supabase) return PRODUCTS.find((p) => p.barcode === code);
  const { data } = await supabase.from('product_prices').select('*').eq('barcode', code).maybeSingle();
  return data ? rowToProduct(data as ProductPriceRow) : undefined;
}

export async function fetchBranches(): Promise<Branch[]> {
  if (!supabase) return BRANCHES;
  const { data } = await supabase.from('branches').select('*');
  if (!data) return BRANCHES;
  // Distance/walk time are computed client-side from the user's location in production.
  return data.map((b) => ({
    id: b.id,
    storeId: b.store_id as StoreId,
    name: b.name,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    openUntil: b.open_until ?? '',
    distanceKm: BRANCHES.find((x) => x.id === b.id)?.distanceKm ?? 0,
    walkMinutes: BRANCHES.find((x) => x.id === b.id)?.walkMinutes ?? 0,
  }));
}
