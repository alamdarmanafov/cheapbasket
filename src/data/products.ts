/**
 * Catalog model + runtime registry. Everything comes from Supabase
 * (stores, products, prices, branches) — there is no bundled demo data.
 */

export type StoreId = string;

export interface Store {
  id: StoreId;
  name: string;
  /** Brand tint for the store avatar */
  color: string;
  initial: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  size: string;
  category: string;
  /** Emoji stands in when there is no product photo. */
  emoji: string;
  /** Soft background tint behind the product visual. */
  tint: string;
  imageUrl?: string | null;
  /** Price per store id in ₼; null/missing = product unavailable in that store. */
  prices: Record<StoreId, number | null>;
  /** Regular (pre-discount) price per store id, only where the store currently runs a discount. */
  regularPrices: Record<StoreId, number>;
  /** ISO date (YYYY-MM-DD) when the discount ends, per store. Only present when the admin set an end date. */
  discountEnds?: Record<StoreId, string>;
  /** ISO date (YYYY-MM-DD) when the discount starts, per store. Only present when the admin set a start date. */
  discountStarts?: Record<StoreId, string>;
  /** Recorded prices (oldest → newest) in the cheapest store; empty until history exists. */
  history: number[];
  /** Minutes since the price was last verified. */
  updatedMinutesAgo: number;
  rating?: number;
}

export interface Branch {
  id: string;
  storeId: StoreId;
  name: string;
  address: string;
  distanceKm: number;
  walkMinutes: number;
  lat: number;
  lng: number;
  openUntil: string;
  /** Google Maps place link from the admin panel (optional). */
  mapsUrl?: string | null;
  phone?: string | null;
  /** Opening time 'HH:MM' (optional); openUntil is the closing time. */
  openFrom?: string | null;
  alwaysOpen?: boolean;
}

/** true/false when hours are known (Baku time), null when the branch has no hours. */
export function isOpenNow(b: Branch, now = new Date()): boolean | null {
  if (b.alwaysOpen) return true;
  if (!b.openUntil) return null;
  const toMin = (t: string) => {
    const m = t.match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const baku = new Date(now.getTime() + (4 * 60 + now.getTimezoneOffset()) * 60000);
  const cur = baku.getHours() * 60 + baku.getMinutes();
  const close = toMin(b.openUntil);
  const open = b.openFrom ? toMin(b.openFrom) : 0;
  if (close == null || open == null) return null;
  if (close === 0) return cur >= open; // closes at midnight
  if (close < open) return cur >= open || cur < close; // past midnight, e.g. 08:00–02:00
  return cur >= open && cur < close;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Fallback until the device location is known: Bakı centre. */
export const DEFAULT_LOCATION: LatLng = { lat: 40.4093, lng: 49.8671 };

/** Runtime registry, filled by CatalogProvider. */
export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  bgColor: string;
  textColor: string;
  /** In-app route (starts with '/') or an https:// link. */
  link: string | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string | null;
}

export const catalog = {
  categories: [] as Category[],
  stores: [] as Store[],
  products: [] as Product[],
  branches: [] as Branch[],
  location: { ...DEFAULT_LOCATION } as LatLng,
};

export const storeIds = (): StoreId[] => catalog.stores.map((s) => s.id);

export function getStore(id: StoreId): Store {
  return catalog.stores.find((s) => s.id === id) ?? { id, name: id, color: '#6B7280', initial: id.slice(0, 1).toUpperCase() };
}

export function getProduct(id: string): Product | undefined {
  return catalog.products.find((p) => p.id === id);
}

export function findByBarcode(code: string): Product | undefined {
  return catalog.products.find((p) => p.barcode === code);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g');

export function searchProducts(query: string): Product[] {
  const q = norm(query.trim());
  if (!q) return [];
  return catalog.products.filter((p) => norm(`${p.brand} ${p.name} ${p.category}`).includes(q));
}

/** Category names present in the current catalog, in admin order (for chips). */
export function catalogCategories(): string[] {
  const present = new Set(catalog.products.map((p) => p.category));
  const ordered = catalog.categories.map((c) => c.name).filter((n) => present.has(n));
  const rest = [...present].filter((n) => !ordered.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

/** Emoji for a category name, when the admin set one. */
export function categoryEmoji(name: string): string | null {
  return catalog.categories.find((c) => c.name === name)?.emoji ?? null;
}

export interface StorePrice {
  store: Store;
  price: number | null;
  /** Crossed-out regular price when the store has a discount on this product. */
  regular?: number;
  /** ISO date string (YYYY-MM-DD) when this store's discount expires. */
  discountEnds?: string;
  /** ISO date string (YYYY-MM-DD) when this store's discount starts. */
  discountStarts?: string;
}

/** Prices sorted cheapest → most expensive; unavailable last. */
export function sortedPrices(p: Product): StorePrice[] {
  return catalog.stores
    .map((store) => ({
      store,
      price: p.prices[store.id] ?? null,
      regular: p.regularPrices?.[store.id],
      discountEnds: p.discountEnds?.[store.id],
      discountStarts: p.discountStarts?.[store.id],
    }))
    .sort((a, b) => {
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    });
}

export function cheapest(p: Product): StorePrice {
  return sortedPrices(p)[0] ?? { store: getStore('—'), price: null };
}

export function mostExpensive(p: Product): StorePrice {
  const available = sortedPrices(p).filter((s) => s.price != null);
  return available[available.length - 1] ?? cheapest(p);
}

/** Max saving on this product = most expensive − cheapest. */
export function maxSaving(p: Product): number {
  const c = cheapest(p).price ?? 0;
  const m = mostExpensive(p).price ?? 0;
  return Math.max(0, m - c);
}

/** Alternatives in the same category, cheaper first. */
export function cheaperAlternatives(p: Product, limit = 3): Product[] {
  const base = cheapest(p).price ?? Infinity;
  return catalog.products
    .filter((x) => x.id !== p.id && x.category === p.category)
    .sort((a, b) => (cheapest(a).price ?? 0) - (cheapest(b).price ?? 0))
    .filter((x) => (cheapest(x).price ?? Infinity) <= base + 1)
    .slice(0, limit);
}

export function nearestBranch(storeId: StoreId): Branch | undefined {
  return catalog.branches.filter((b) => b.storeId === storeId).sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

/** Straight-line distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Recompute branch distances from a location (walking ≈ 12 min/km). */
export function withDistances(branches: Branch[], from: LatLng): Branch[] {
  return branches.map((b) => {
    const km = haversineKm(from, { lat: b.lat, lng: b.lng });
    return { ...b, distanceKm: Math.round(km * 10) / 10, walkMinutes: Math.max(1, Math.round(km * 12)) };
  });
}

/** Display name for a store: "Araz Market", but "Bazarstore" / "Market A" stay as they are. */
export function storeLabel(store: { name: string }): string {
  return /market/i.test(store.name) ? store.name : `${store.name} Market`;
}
