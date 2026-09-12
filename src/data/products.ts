/**
 * Catalog model + runtime registry. Everything comes from Supabase
 * (stores, products, prices, branches) — there is no bundled demo data.
 */

import { categoryLabel } from './categoryNames';
import { normalizeGtin } from '@/lib/gtin';

export type StoreId = string;

export interface Store {
  id: StoreId;
  name: string;
  /** Brand tint for the store avatar */
  color: string;
  initial: string;
  logo_url?: string | null;
  /** Chain-wide opening hours; a branch without its own hours inherits these. */
  openFrom?: string | null;
  openUntil?: string | null;
  alwaysOpen?: boolean;
}

/**
 * Fills a branch's missing hours from its store.
 *
 * Hours are entered once per chain in the admin panel, so most branches carry
 * none of their own. A branch that does keep its own values wins — that is how
 * one late-closing shop in a chain stays correct.
 */
export function withStoreHours(branches: Branch[], stores: Store[]): Branch[] {
  const byId = new Map(stores.map((s) => [s.id, s]));
  return branches.map((b) => {
    const s = byId.get(b.storeId);
    if (!s) return b;
    const hasOwn = b.alwaysOpen || !!b.openUntil || !!b.openFrom;
    if (hasOwn) return b;
    return { ...b, openFrom: s.openFrom ?? null, openUntil: s.openUntil ?? '', alwaysOpen: !!s.alwaysOpen };
  });
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

/**
 * True when the branch never closes. Either the admin ticked "24 saat", or the
 * hours were typed as a window that covers the whole day — 00:00 to 23:59 is
 * how a round-the-clock store usually gets entered, and showing "23:59-dək"
 * for it reads as a closing time that isn't one.
 */
export function isAllDay(b: Branch): boolean {
  if (b.alwaysOpen) return true;
  const until = (b.openUntil ?? '').trim();
  const from = (b.openFrom ?? '').trim();
  if (!until) return false;
  return /^0?0:00/.test(from || '00:00') && /^(23:59|00:00|24:00)/.test(until);
}

/** true/false when hours are known (Baku time), null when the branch has no hours. */
export function isOpenNow(b: Branch, now = new Date()): boolean | null {
  if (isAllDay(b)) return true;
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
  /** Display names by language, set in the admin panel; missing keys fall back to the built-in table. */
  names?: Partial<Record<'en' | 'tr' | 'ru', string>>;
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
  // The catalogue's barcodes are normalised on load; the scanner's reading is
  // normalised here, so "0" + EAN-13 from one side meets the EAN-13 from the other.
  const want = normalizeGtin(code);
  if (!want) return undefined;
  return catalog.products.find((p) => p.barcode === want);
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

/** Edit distance capped at 2: enough to say "one letter off" without walking the whole matrix. */
function within1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function searchProducts(query: string): Product[] {
  const q = norm(query.trim());
  if (!q) return [];
  // The category is stored in Azerbaijani, so someone reading the app in English
  // would type the word on the chip in front of them and match nothing. Both the
  // stored name and the displayed one are searched.
  //
  // Exact substring matches come first. Behind them, a word of four letters
  // or more may be one letter off from a word in the product — "yumrta" finds
  // yumurta, "qatiq" already did through normalisation. Shorter words stay
  // exact: at three letters one edit matches half the dictionary.
  const words = q.split(/\s+/).filter(Boolean);
  const exact: Product[] = [];
  const near: Product[] = [];
  for (const p of catalog.products) {
    const hay = norm(`${p.brand} ${p.name} ${p.category} ${categoryLabel(p.category)}`);
    if (hay.includes(q)) {
      exact.push(p);
      continue;
    }
    const tokens = hay.split(/[^a-z0-9]+/).filter(Boolean);
    const ok = words.every((w) => hay.includes(w) || (w.length >= 4 && tokens.some((tk) => within1(w, tk))));
    if (ok) near.push(p);
  }
  return [...exact, ...near];
}

/** Category names present in the current catalog, in admin order (for chips). */
export function catalogCategories(): string[] {
  const present = new Set(catalog.products.map((p) => p.category));
  const ordered = catalog.categories.map((c) => c.name).filter((n) => present.has(n));
  const rest = [...present].filter((n) => !ordered.includes(n)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

/**
 * How many catalogue products this store has a price for.
 *
 * A basket of three where a store carries none reads as "3 yoxdur", which looks
 * like a verdict on the store when it is really a verdict on our data. The count
 * says which one it is. Memoised on the products array, since it walks the whole
 * catalogue and the ranked list asks once per store.
 */
let coverageOf: Product[] | null = null;
let coverage = new Map<StoreId, number>();
export function storeProductCount(storeId: StoreId): number {
  if (coverageOf !== catalog.products) {
    coverageOf = catalog.products;
    coverage = new Map();
    for (const p of catalog.products) {
      for (const [id, price] of Object.entries(p.prices)) {
        if (price != null) coverage.set(id, (coverage.get(id) ?? 0) + 1);
      }
    }
  }
  return coverage.get(storeId) ?? 0;
}

/** Age of the oldest price among these products, for a "checked N ago" line. */
export function stalestMinutes(products: Product[]): number {
  return products.reduce((m, p) => Math.max(m, p.updatedMinutesAgo), 0);
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

/**
 * Recompute branch distances from a location (walking ≈ 12 min/km), nearest first.
 *
 * The screens that show branches all mean "the ones near me": the branch list,
 * the nearby screen, the map's list. They rendered in whatever order the table
 * came back in, so a branch 9 km away sat above one 500 m away. Sorting here
 * rather than in each screen keeps that from being re-decided per screen — and
 * the distance is computed with full precision, so two branches a few hundred
 * metres apart do not tie on their rounded labels.
 */
export function withDistances(branches: Branch[], from: LatLng): Branch[] {
  return branches
    .map((b) => {
      const km = haversineKm(from, { lat: b.lat, lng: b.lng });
      return { ...b, km, distanceKm: Math.round(km * 10) / 10, walkMinutes: Math.max(1, Math.round(km * 12)) };
    })
    .sort((a, b) => a.km - b.km)
    .map(({ km, ...b }) => b);
}

/** Display name for a store: "Araz Market", but "Bazarstore" / "Market A" stay as they are. */
export function storeLabel(store: { name: string }): string {
  return /market/i.test(store.name) ? store.name : `${store.name} Market`;
}
