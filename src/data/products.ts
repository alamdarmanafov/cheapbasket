export type StoreId = 'araz' | 'bravo' | 'neptun' | 'bazarstore';

export interface Store {
  id: StoreId;
  name: string;
  /** Brand tint for the store avatar */
  color: string;
  initial: string;
}

export const STORES: Record<StoreId, Store> = {
  araz: { id: 'araz', name: 'Araz', color: '#0F9D58', initial: 'A' },
  bravo: { id: 'bravo', name: 'Bravo', color: '#E64A19', initial: 'B' },
  neptun: { id: 'neptun', name: 'Neptun', color: '#1E63D6', initial: 'N' },
  bazarstore: { id: 'bazarstore', name: 'Bazarstore', color: '#F59E0B', initial: 'Bz' },
};

export const STORE_IDS: StoreId[] = ['araz', 'bravo', 'neptun', 'bazarstore'];

export type Category =
  | 'Süd məhsulları'
  | 'Yumurta'
  | 'Qida'
  | 'İçkilər'
  | 'Ət'
  | 'Meyvə-tərəvəz'
  | 'Çörək'
  | 'Şirniyyat'
  | 'Ev və gigiyena';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  size: string;
  category: Category;
  /** Emoji stands in for catalog photography in the prototype. */
  emoji: string;
  /** Soft background tint behind the product visual. */
  tint: string;
  /** Price per store in ₼; null = product unavailable in that store. */
  prices: Record<StoreId, number | null>;
  /** Last 6 recorded prices (oldest → newest), cheapest store. */
  history: number[];
  /** Minutes since the price was last verified. */
  updatedMinutesAgo: number;
  rating?: number;
}

export const PRODUCTS: Product[] = [
  {
    id: 'sutas-sud-1l',
    barcode: '8690767010012',
    name: 'Süd 3.5%',
    brand: 'Sütaş',
    size: '1 L',
    category: 'Süd məhsulları',
    emoji: '🥛',
    tint: '#EEF4FF',
    prices: { araz: 2.05, bravo: 2.19, neptun: 2.09, bazarstore: 2.29 },
    history: [1.95, 1.99, 1.99, 2.05, 2.05, 2.05],
    updatedMinutesAgo: 12,
    rating: 4.6,
  },
  {
    id: 'yumurta-10',
    barcode: '4760012345678',
    name: 'Kənd yumurtası',
    brand: 'Bizim Ferma',
    size: '10 ədəd',
    category: 'Yumurta',
    emoji: '🥚',
    tint: '#FFF6E5',
    prices: { araz: 3.60, bravo: 3.40, neptun: 3.55, bazarstore: 3.49 },
    history: [3.20, 3.20, 3.30, 3.40, 3.40, 3.40],
    updatedMinutesAgo: 25,
    rating: 4.4,
  },
  {
    id: 'duyu-1kg',
    barcode: '4760098765432',
    name: 'Düyü Basmati',
    brand: 'Bəyaz',
    size: '1 kq',
    category: 'Qida',
    emoji: '🍚',
    tint: '#F3F4F6',
    prices: { araz: 4.35, bravo: 4.20, neptun: 4.49, bazarstore: 4.29 },
    history: [4.10, 4.10, 4.20, 4.20, 4.20, 4.20],
    updatedMinutesAgo: 40,
    rating: 4.5,
  },
  {
    id: 'nescafe-gold-95',
    barcode: '7613036940405',
    name: 'Gold həll olan qəhvə',
    brand: 'Nescafé',
    size: '95 q',
    category: 'İçkilər',
    emoji: '☕',
    tint: '#F5EDE6',
    prices: { araz: 8.99, bravo: 8.50, neptun: 8.79, bazarstore: 9.20 },
    history: [7.90, 8.20, 8.20, 8.50, 8.50, 8.50],
    updatedMinutesAgo: 8,
    rating: 4.7,
  },
  {
    id: 'toyuq-file-1kg',
    barcode: '4760011122233',
    name: 'Toyuq filesi',
    brand: 'Bizim Ferma',
    size: '1 kq',
    category: 'Ət',
    emoji: '🍗',
    tint: '#FFF1EC',
    prices: { araz: 7.90, bravo: 8.90, neptun: 8.40, bazarstore: null },
    history: [7.50, 7.60, 7.90, 7.90, 7.90, 7.90],
    updatedMinutesAgo: 55,
    rating: 4.3,
  },
  {
    id: 'corek-tandir',
    barcode: '4760055566677',
    name: 'Təndir çörəyi',
    brand: 'Bakı çörək',
    size: '400 q',
    category: 'Çörək',
    emoji: '🍞',
    tint: '#FFF6E5',
    prices: { araz: 0.70, bravo: 0.75, neptun: 0.70, bazarstore: 0.80 },
    history: [0.60, 0.65, 0.65, 0.70, 0.70, 0.70],
    updatedMinutesAgo: 18,
  },
  {
    id: 'banan-1kg',
    barcode: '4760099988877',
    name: 'Banan',
    brand: 'Ekvador',
    size: '1 kq',
    category: 'Meyvə-tərəvəz',
    emoji: '🍌',
    tint: '#FFFBE6',
    prices: { araz: 2.49, bravo: 2.69, neptun: 2.39, bazarstore: 2.59 },
    history: [2.20, 2.29, 2.39, 2.39, 2.39, 2.39],
    updatedMinutesAgo: 30,
  },
  {
    id: 'coca-cola-1l',
    barcode: '5449000000996',
    name: 'Klassik',
    brand: 'Coca-Cola',
    size: '1 L',
    category: 'İçkilər',
    emoji: '🥤',
    tint: '#FDECEC',
    prices: { araz: 1.85, bravo: 1.79, neptun: 1.89, bazarstore: 1.75 },
    history: [1.65, 1.69, 1.75, 1.75, 1.75, 1.75],
    updatedMinutesAgo: 5,
    rating: 4.8,
  },
  {
    id: 'pendir-atena-400',
    barcode: '4760033344455',
    name: 'Ağ pendir',
    brand: 'Atena',
    size: '400 q',
    category: 'Süd məhsulları',
    emoji: '🧀',
    tint: '#FFFBE6',
    prices: { araz: 5.20, bravo: 5.49, neptun: 5.35, bazarstore: 5.10 },
    history: [4.80, 4.90, 5.10, 5.10, 5.10, 5.10],
    updatedMinutesAgo: 47,
    rating: 4.2,
  },
  {
    id: 'pomidor-1kg',
    barcode: '4760077788899',
    name: 'Pomidor',
    brand: 'Yerli',
    size: '1 kq',
    category: 'Meyvə-tərəvəz',
    emoji: '🍅',
    tint: '#FDECEC',
    prices: { araz: 2.90, bravo: 3.20, neptun: 2.99, bazarstore: 2.79 },
    history: [3.50, 3.20, 3.10, 2.90, 2.79, 2.79],
    updatedMinutesAgo: 22,
  },
  {
    id: 'barilla-500',
    barcode: '8076809513388',
    name: 'Spaghetti №5',
    brand: 'Barilla',
    size: '500 q',
    category: 'Qida',
    emoji: '🍝',
    tint: '#EEF4FF',
    prices: { araz: 3.15, bravo: 2.99, neptun: 3.25, bazarstore: 3.05 },
    history: [2.90, 2.90, 2.99, 2.99, 2.99, 2.99],
    updatedMinutesAgo: 60,
    rating: 4.6,
  },
  {
    id: 'kere-yagi-200',
    barcode: '4760066677788',
    name: 'Kərə yağı 82%',
    brand: 'Milla',
    size: '200 q',
    category: 'Süd məhsulları',
    emoji: '🧈',
    tint: '#FFFBE6',
    prices: { araz: 4.75, bravo: 4.99, neptun: 4.60, bazarstore: 4.85 },
    history: [4.30, 4.40, 4.50, 4.60, 4.60, 4.60],
    updatedMinutesAgo: 35,
  },
  {
    id: 'sirab-1-5l',
    barcode: '4760022233344',
    name: 'Qazsız su',
    brand: 'Sirab',
    size: '1.5 L',
    category: 'İçkilər',
    emoji: '💧',
    tint: '#EEF4FF',
    prices: { araz: 0.65, bravo: 0.69, neptun: 0.65, bazarstore: 0.60 },
    history: [0.55, 0.60, 0.60, 0.60, 0.60, 0.60],
    updatedMinutesAgo: 14,
  },
  {
    id: 'seker-1kg',
    barcode: '4760044455566',
    name: 'Şəkər tozu',
    brand: 'Azərsun',
    size: '1 kq',
    category: 'Qida',
    emoji: '🍬',
    tint: '#F3F4F6',
    prices: { araz: 1.95, bravo: 1.99, neptun: 1.89, bazarstore: 1.95 },
    history: [1.80, 1.85, 1.89, 1.89, 1.89, 1.89],
    updatedMinutesAgo: 90,
  },
  {
    id: 'un-2kg',
    barcode: '4760088899900',
    name: 'Buğda unu',
    brand: 'Karat',
    size: '2 kq',
    category: 'Qida',
    emoji: '🌾',
    tint: '#FFF6E5',
    prices: { araz: 3.10, bravo: 3.30, neptun: null, bazarstore: 2.99 },
    history: [2.85, 2.90, 2.99, 2.99, 2.99, 2.99],
    updatedMinutesAgo: 120,
  },
  {
    id: 'sokolad-milka',
    barcode: '7622210681249',
    name: 'Südlü şokolad',
    brand: 'Milka',
    size: '90 q',
    category: 'Şirniyyat',
    emoji: '🍫',
    tint: '#F1ECFA',
    prices: { araz: 2.40, bravo: 2.29, neptun: 2.45, bazarstore: 2.35 },
    history: [2.10, 2.15, 2.20, 2.29, 2.29, 2.29],
    updatedMinutesAgo: 9,
    rating: 4.7,
  },
  {
    id: 'sire-portagal-1l',
    barcode: '4760012399001',
    name: 'Portağal şirəsi',
    brand: 'Pal',
    size: '1 L',
    category: 'İçkilər',
    emoji: '🥤',
    tint: '#FFF6E5',
    prices: { araz: 2.45, bravo: 2.69, neptun: 2.55, bazarstore: 2.49 },
    history: [2.30, 2.35, 2.45, 2.45, 2.45, 2.45],
    updatedMinutesAgo: 16,
    rating: 4.4,
  },
  {
    id: 'sampun-400',
    barcode: '8001090000000',
    name: 'Şampun 2-in-1',
    brand: 'Head & Shoulders',
    size: '400 ml',
    category: 'Ev və gigiyena',
    emoji: '🧴',
    tint: '#EEF4FF',
    prices: { araz: 7.90, bravo: 8.90, neptun: 8.20, bazarstore: 8.40 },
    history: [7.50, 7.60, 7.90, 7.90, 7.90, 7.90],
    updatedMinutesAgo: 70,
    rating: 4.5,
  },
  {
    id: 'zeytun-yagi-500',
    barcode: '8410010800000',
    name: 'Zeytun yağı Extra Virgin',
    brand: 'Borges',
    size: '500 ml',
    category: 'Qida',
    emoji: '🫒',
    tint: '#EEF7E8',
    prices: { araz: 11.90, bravo: 12.40, neptun: 12.10, bazarstore: 12.90 },
    history: [10.90, 11.20, 11.50, 11.90, 11.90, 11.90],
    updatedMinutesAgo: 44,
    rating: 4.6,
  },
];

/** Runtime registry: starts with the bundled mock and is replaced by Supabase data when configured. */
export const catalog = { products: PRODUCTS as Product[], branches: [] as Branch[] };

export const POPULAR_SEARCHES = ['Süd', 'Yumurta', 'Qəhvə', 'Toyuq', 'Düyü', 'Çörək'];

/** Home-screen quick picks for a first-time or returning user. */
export const FEATURED_IDS = ['sutas-sud-1l', 'nescafe-gold-95', 'coca-cola-1l', 'pomidor-1kg', 'sokolad-milka'];

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

export interface StorePrice {
  store: Store;
  price: number | null;
}

/** Prices sorted cheapest → most expensive; unavailable last. */
export function sortedPrices(p: Product): StorePrice[] {
  return STORE_IDS.map((id) => ({ store: STORES[id], price: p.prices[id] })).sort((a, b) => {
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return a.price - b.price;
  });
}

export function cheapest(p: Product): StorePrice {
  return sortedPrices(p)[0];
}

export function mostExpensive(p: Product): StorePrice {
  const available = sortedPrices(p).filter((s) => s.price != null);
  return available[available.length - 1];
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
  return catalog.products.filter((x) => x.id !== p.id && x.category === p.category)
    .sort((a, b) => (cheapest(a).price ?? 0) - (cheapest(b).price ?? 0))
    .filter((x) => (cheapest(x).price ?? Infinity) <= base + 1)
    .slice(0, limit);
}

/* ---------- Branches (nearest to the user, Bakı) ---------- */

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
}

/** Demo user location: Nərimanov, Bakı */
export const USER_LOCATION = { lat: 40.4093, lng: 49.8671 };

export const BRANCHES: Branch[] = [
  { id: 'araz-narimanov', storeId: 'araz', name: 'Araz Market', address: 'Ə. Ələkbərov küç. 12, Nərimanov', distanceKm: 1.2, walkMinutes: 5, lat: 40.4165, lng: 49.8752, openUntil: '23:00' },
  { id: 'bravo-genclik', storeId: 'bravo', name: 'Bravo Supermarket', address: 'Gənclik Mall, Fətəli xan Xoyski', distanceKm: 2.4, walkMinutes: 9, lat: 40.4009, lng: 49.8523, openUntil: '00:00' },
  { id: 'neptun-narimanov', storeId: 'neptun', name: 'Neptun', address: 'Təbriz küç. 45, Nərimanov', distanceKm: 1.8, walkMinutes: 7, lat: 40.4175, lng: 49.8560, openUntil: '22:00' },
  { id: 'bazarstore-nizami', storeId: 'bazarstore', name: 'Bazarstore', address: 'Qara Qarayev pr. 88, Nizami', distanceKm: 3.1, walkMinutes: 12, lat: 40.3980, lng: 49.8880, openUntil: '23:00' },
];

export function nearestBranch(storeId: StoreId): Branch {
  const all = catalog.branches.length ? catalog.branches : BRANCHES;
  return all.filter((b) => b.storeId === storeId).sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? BRANCHES.find((b) => b.storeId === storeId)!;
}
