/**
 * Wolt venue importer: reads the public assortment JSON behind a wolt.com venue page and
 * normalises items into products + regular/discount prices.
 * Wolt's API shape changes over time, so several endpoints and field names are tried.
 */
export interface WoltItem {
  ext_id: string;
  name: string;
  description: string | null;
  /** Current selling price in ₼ (discounted if a promo applies). */
  price: number | null;
  /** Regular price in ₼ when a discount applies, else null. */
  regular_price: number | null;
  barcode: string | null;
  image_url: string | null;
  category: string | null;
}

export interface WoltResult {
  venue: string;
  items: WoltItem[];
  categories: string[];
  debug: { endpoint: string; topKeys: string[]; sampleKeys: string[] };
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function venueSlug(input: string): string {
  const s = input.trim();
  const m = s.match(/\/venue\/([^/?#]+)/);
  if (m) return m[1];
  if (/^[a-z0-9-]+$/i.test(s)) return s;
  throw new Error('Wolt venue linki tanınmadı. Nümunə: https://wolt.com/az/aze/baku/venue/wolt-market-landmark');
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'az,en' }, cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

/** Wolt prices are integers in minor units (250 = 2.50 ₼); floats are taken as-is. */
function money(v: unknown): number | null {
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) v = Number(v);
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return Number.isInteger(v) ? v / 100 : Math.round(v * 100) / 100;
}

function firstImage(it: Obj): string | null {
  const imgs = arr(it.images);
  for (const i of imgs) {
    const o = obj(i);
    const u = o ? str(o.url) ?? str(o.src) : str(i);
    if (u) return u;
  }
  return str(it.image) ?? str(it.image_url) ?? (obj(it.image) ? str((obj(it.image) as Obj).url) : null);
}

function normalise(it: Obj, categoryOf: (it: Obj) => string | null): WoltItem | null {
  const id = str(it.id) ?? str(it.item_id) ?? str(it._id);
  const name = str(it.name) ?? str(it.title);
  if (!id || !name) return null;
  const price = money(it.price) ?? money(it.baseprice) ?? money(it.base_price) ?? money(obj(it.price)?.amount);
  const orig = money(it.original_price) ?? money(it.original_baseprice) ?? money(it.price_before_discount) ?? money(it.regular_price);
  const bc = str(it.barcode_gtin) ?? str(it.gtin) ?? str(it.barcode) ?? str(it.ean);
  return {
    ext_id: id,
    name,
    description: str(it.description),
    price,
    regular_price: orig != null && price != null && orig > price ? orig : null,
    barcode: bc && /^\d{8,14}$/.test(bc) ? bc : null,
    image_url: firstImage(it),
    category: categoryOf(it),
  };
}

/** Builds item → category-name resolver from a categories array (ids/items lists) and item.category fields. */
function categoryResolver(categories: unknown[]): (it: Obj) => string | null {
  const byId = new Map<string, string>();
  const itemToCat = new Map<string, string>();
  const walk = (cats: unknown[], parent: string | null) => {
    for (const c of cats) {
      const o = obj(c);
      if (!o) continue;
      const name = str(o.name) ?? parent;
      const id = str(o.id) ?? str(o.slug);
      if (id && name) byId.set(id, name);
      for (const x of arr(o.items)) {
        const xo = obj(x);
        const xid = xo ? str(xo.id) : str(x);
        if (xid && name) itemToCat.set(xid, name);
      }
      for (const xid of arr(o.item_ids)) if (str(xid) && name) itemToCat.set(str(xid) as string, name);
      walk(arr(o.subcategories ?? o.children), name);
    }
  };
  walk(categories, null);
  return (it) => {
    const id = str(it.id) ?? str(it.item_id);
    if (id && itemToCat.has(id)) return itemToCat.get(id) ?? null;
    const cat = str(it.category) ?? str(it.category_id) ?? (obj(it.category) ? str((obj(it.category) as Obj).name) : null);
    if (cat) return byId.get(cat) ?? cat;
    for (const cid of arr(it.category_ids)) if (str(cid) && byId.has(str(cid) as string)) return byId.get(str(cid) as string) ?? null;
    return null;
  };
}

/** Collect items from a Wolt payload (items at top level or nested in categories). */
function extract(payload: unknown, endpoint: string): WoltResult | null {
  const p = obj(payload);
  if (!p) return null;
  const root = obj(p.assortment) ?? obj(p.data) ?? p;
  const categories = arr(root.categories);
  const resolver = categoryResolver(categories);
  const seen = new Map<string, WoltItem>();
  const add = (x: unknown) => {
    const o = obj(x);
    const n = o && normalise(o, resolver);
    if (n && !seen.has(n.ext_id)) seen.set(n.ext_id, n);
  };
  arr(root.items).forEach(add);
  const walk = (cats: unknown[]) => {
    for (const c of cats) {
      const o = obj(c);
      if (!o) continue;
      arr(o.items).forEach(add);
      walk(arr(o.subcategories ?? o.children));
    }
  };
  walk(categories);
  const items = [...seen.values()];
  const sample = obj(arr(root.items)[0]) ?? null;
  return {
    venue: str(obj(root.venue)?.name) ?? '',
    items,
    categories: [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))],
    debug: { endpoint, topKeys: Object.keys(root).slice(0, 30), sampleKeys: sample ? Object.keys(sample).slice(0, 40) : [] },
  };
}

/** Newer consumer API: /assortment lists categories; item bodies come per category. */
async function consumerApi(slug: string): Promise<WoltResult | null> {
  const base = `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/venues/slug/${encodeURIComponent(slug)}/assortment`;
  const top = await getJson(`${base}?language=az`);
  const first = extract(top, base);
  if (!first) return null;
  const cats = arr(obj(top)?.categories);
  const slugs = cats.map((c) => str(obj(c)?.slug)).filter((s): s is string => !!s);
  if (first.items.length > 50 || !slugs.length) return first;

  // Fetch each category (limited concurrency) and merge.
  const merged = new Map<string, WoltItem>(first.items.map((i) => [i.ext_id, i]));
  let idx = 0;
  const worker = async () => {
    while (idx < slugs.length) {
      const s = slugs[idx++];
      const catName = str(obj(cats.find((c) => str(obj(c)?.slug) === s))?.name);
      try {
        const r = extract(await getJson(`${base}/categories/slug/${encodeURIComponent(s)}?language=az`), base);
        r?.items.forEach((i) => merged.set(i.ext_id, { ...i, category: i.category ?? catName }));
      } catch {
        /* skip category */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, slugs.length) }, worker));
  const items = [...merged.values()];
  return { ...first, items, categories: [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))] };
}

/** Older restaurant API: one call with every item. */
async function restaurantApi(slug: string): Promise<WoltResult | null> {
  const url = `https://restaurant-api.wolt.com/v4/venues/slug/${encodeURIComponent(slug)}/menu?unit_prices=true&show_weighted_items=true&show_subcategories=true`;
  return extract(await getJson(url), url);
}

export async function fetchWoltVenue(input: string): Promise<WoltResult> {
  const slug = venueSlug(input);
  const errors: string[] = [];
  for (const fn of [consumerApi, restaurantApi]) {
    try {
      const r = await fn(slug);
      if (r && r.items.length) return r;
      if (r) errors.push(`${r.debug.endpoint}: məhsul tapılmadı (açarlar: ${r.debug.topKeys.join(', ')})`);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  throw new Error(`Wolt-dan məhsul çəkilmədi. ${errors.join(' | ')}`);
}

/** Keyword mapping from Wolt category / product name to the app's categories. */
export function mapCategory(woltCategory: string | null, name: string, categories: string[]): string {
  const t = `${woltCategory ?? ''} ${name}`.toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/yumurta/, 'Yumurta'],
    [/süd|pendir|qatıq|kəsmik|yoğurt|yogurt|ayran|kərə|smetan|qaymaq|dairy|milk|cheese/, 'Süd məhsulları'],
    [/meyvə|tərəvəz|göyərti|fruit|vegetable|alma|banan|pomidor|xiyar|kartof|soğan/, 'Meyvə-tərəvəz'],
    [/çörək|lavaş|bulka|bread|bakery|un məmulat/, 'Çörək'],
    [/toyuq|ət\b|kolbasa|sosis|balıq|mal əti|quzu|meat|chicken|fish|hisə/, 'Ət'],
    [/şokolad|konfet|peçenye|vafli|şirniyyat|tort|dondurma|chocolate|candy|cookie|sweet|dessert/, 'Şirniyyat'],
    [/su\b|içki|şirə|çay|kofe|qəhvə|kola|limonad|pivə|şərab|water|drink|juice|tea|coffee|beverage/, 'İçkilər'],
    [/təmizlik|gigiyena|sabun|şampun|diş|yuyucu|salfet|kağız|ev\b|household|hygiene|clean|soap|shampoo|toilet/, 'Ev və gigiyena'],
  ];
  for (const [re, cat] of rules) if (re.test(t) && categories.includes(cat)) return cat;
  return categories.includes('Qida') ? 'Qida' : categories[0];
}

const SIZE_RE = /(\d+(?:[.,]\d+)?\s?(?:kq|kg|qr|q|g|l|lt|ml|ədəd|əd|pcs|x\s?\d+\s?(?:ml|l|q|g)))\b\.?$/i;

/** "Sütaş Süd 3.2% 1 L" → brand "Sütaş", name "Süd 3.2%", size "1 L". */
export function splitName(full: string): { brand: string; name: string; size: string } {
  let rest = full.replace(/\s+/g, ' ').trim();
  let size = '';
  const m = rest.match(SIZE_RE);
  if (m) {
    size = m[1].replace(',', '.');
    rest = rest.slice(0, m.index).replace(/[,\-–]\s*$/, '').trim();
  }
  const words = rest.split(' ');
  if (words.length >= 2) return { brand: words[0], name: words.slice(1).join(' '), size: size || '—' };
  return { brand: '', name: rest, size: size || '—' };
}
