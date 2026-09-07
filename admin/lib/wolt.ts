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

/** Slug from any Wolt venue URL form: /venue/<slug>, /restaurant/<slug>, ?venue=<slug>, or a bare slug. */
export function venueSlug(input: string): string | null {
  const s = decodeURIComponent(input.trim());
  const m = s.match(/\/(?:venue|restaurant|store)\/([a-z0-9][a-z0-9-]*)/i) ?? s.match(/[?&](?:venue|slug)=([a-z0-9][a-z0-9-]*)/i);
  if (m) return m[1].toLowerCase();
  if (/^[a-z0-9][a-z0-9-]*$/i.test(s) && !/^https?:/i.test(s)) return s.toLowerCase();
  return null;
}

/** Resolve short / share links (wolt.page.link, wolt.com/s/…, app links) to a venue slug by following redirects and reading the page. */
export async function resolveVenueSlug(input: string): Promise<string> {
  const direct = venueSlug(input);
  if (direct) return direct;
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const res = await fetch(s, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/json' } });
      const fromFinal = venueSlug(res.url || '');
      if (fromFinal) return fromFinal;
      const html = await res.text();
      const m = html.match(/\/venue\/([a-z0-9][a-z0-9-]*)/i) ?? html.match(/"slug"\s*:\s*"([a-z0-9][a-z0-9-]*)"/i);
      if (m) return m[1].toLowerCase();
    } catch {
      /* fall through */
    }
  }
  throw new Error(`Wolt venue linki tanınmadı: "${s.slice(0, 80)}". Wolt-da marketin səhifəsini aç, brauzerin ünvan sətrindəki linki kopyala (…/venue/<ad>), və ya "Wolt-da axtar" ilə tap.`);
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

const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//.test(v);

/** Finds a product photo wherever Wolt puts it: images[].url, image, image_url, imageUrl, photo, media[].url, thumbnail… */
function firstImage(it: Obj): string | null {
  const direct = [it.image_url, it.imageUrl, it.image, it.photo, it.thumbnail, it.picture].find(isHttp);
  if (direct) return direct;
  const lists = [it.images, it.media, it.photos, it.image, it.thumbnail];
  for (const l of lists) {
    for (const i of Array.isArray(l) ? l : [l]) {
      if (isHttp(i)) return i;
      const o = obj(i);
      const u = o && [o.url, o.src, o.image_url, o.original, o.large, o.medium].find(isHttp);
      if (u) return u;
    }
  }
  // last resort: any http string under a key that mentions image/photo (2 levels deep)
  const walk = (o: Obj, depth: number): string | null => {
    for (const [k, v] of Object.entries(o)) {
      if (/image|photo|picture|thumb|media/i.test(k)) {
        if (isHttp(v)) return v;
        const vo = obj(v);
        const u = vo && Object.values(vo).find(isHttp);
        if (u) return u;
        for (const x of arr(v)) {
          if (isHttp(x)) return x;
          const xo = obj(x);
          const xu = xo && Object.values(xo).find(isHttp);
          if (xu) return xu;
        }
      }
      if (depth > 0 && obj(v)) {
        const r = walk(obj(v) as Obj, depth - 1);
        if (r) return r;
      }
    }
    return null;
  };
  return walk(it, 1);
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
  if (first.items.length > 500 || !slugs.length) return first;

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

/** Any shop link: Wolt venues use the Wolt API, everything else goes through the generic page importer. */
export async function fetchAnySource(input: string): Promise<WoltResult> {
  const s = input.trim();
  if (/wolt\.com|wolt\.page\.link|maps\.app\.goo/i.test(s) || !/^https?:\/\//i.test(s)) return fetchWoltVenue(s);
  const { fetchGenericPage } = await import('./generic-import');
  return fetchGenericPage(s);
}

export async function fetchWoltVenue(input: string): Promise<WoltResult> {
  const slug = await resolveVenueSlug(input);
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

const slug = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface MatchableProduct { id: string; barcode: string | null; brand: string; name: string; size: string }

/** Word-order-independent slug: sort the words so "Banan Azərbaycan" == "Azərbaycan Banan". */
const sortedSlug = (s: string) => slug(s).split('-').filter(Boolean).sort().join('-');

/** Existing-product lookup shared by the import page and the sync job: barcode first, then normalised name. */
export function buildMatcher(list: MatchableProduct[]): (it: { name: string; barcode: string | null }) => string | null {
  const byBarcode = new Map(list.filter((p) => p.barcode).map((p) => [p.barcode as string, p.id]));
  const byName = new Map<string, string>();
  const bySorted = new Map<string, string>();
  for (const p of list) {
    const full = `${p.brand} ${p.name} ${p.size}`;
    const short = `${p.brand} ${p.name}`;
    byName.set(slug(full), p.id);
    byName.set(slug(short), p.id);
    bySorted.set(sortedSlug(full), p.id);
    bySorted.set(sortedSlug(short), p.id);
    if (p.id.startsWith('wolt-')) byName.set(p.id.slice(5), p.id);
  }
  return (it) => {
    if (it.barcode && byBarcode.has(it.barcode)) return byBarcode.get(it.barcode) ?? null;
    const sp = splitName(it.name);
    return (
      byName.get(slug(it.name)) ??
      byName.get(slug(`${sp.brand} ${sp.name} ${sp.size}`)) ??
      byName.get(slug(`${sp.brand} ${sp.name}`)) ??
      bySorted.get(sortedSlug(it.name)) ??
      bySorted.get(sortedSlug(`${sp.brand} ${sp.name} ${sp.size}`)) ??
      null
    );
  };
}

export interface WoltVenue { slug: string; name: string; address: string | null; lat: number | null; lng: number | null; url: string; online?: boolean }

/** Walk any Wolt JSON and pick venue-like objects (slug + name + coordinates). */
function collectVenues(payload: unknown): WoltVenue[] {
  const out = new Map<string, WoltVenue>();
  const coords = (o: Obj): { lat: number; lng: number } | null => {
    const loc = obj(o.location) ?? obj(o.coordinates);
    const arrC = arr(loc?.coordinates ?? o.location ?? o.coordinates);
    if (arrC.length === 2 && typeof arrC[0] === 'number' && typeof arrC[1] === 'number') return { lng: arrC[0], lat: arrC[1] };
    if (loc && typeof loc.lat === 'number' && (typeof loc.lon === 'number' || typeof loc.lng === 'number')) return { lat: loc.lat, lng: (loc.lon ?? loc.lng) as number };
    return null;
  };
  const walk = (v: unknown, depth: number) => {
    if (depth > 8) return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    const o = obj(v);
    if (!o) return;
    const slug = str(o.slug);
    const name = str(o.name);
    if (slug && name && (o.address != null || o.location != null || o.coordinates != null) && !/^[0-9a-f]{24}$/.test(slug)) {
      const c = coords(o);
      const addr = str(o.address) ?? str(obj(o.address)?.formatted) ?? str(o.short_description);
      if (!out.has(slug)) out.set(slug, { slug, name, address: addr, lat: c?.lat ?? null, lng: c?.lng ?? null, url: `https://wolt.com/az/aze/baku/venue/${slug}`, online: typeof o.online === 'boolean' ? o.online : undefined });
    }
    Object.values(o).forEach((x) => walk(x, depth + 1));
  };
  walk(payload, 0);
  return [...out.values()];
}

/** Search Wolt for venues by name around Baku (e.g. "Araz", "Bravo"). Tries the known search endpoints. */
export async function searchWoltVenues(q: string, lat = 40.4093, lon = 49.8671): Promise<{ venues: WoltVenue[]; endpoint: string }> {
  const qFirst = q.toLowerCase().split(' ')[0];
  const matchesQuery = (v: WoltVenue) =>
    v.name.toLowerCase().includes(qFirst) ||
    v.slug.includes(qFirst) ||
    // Also match transliterated: Araz→araz, Bravo→bravo, etc.
    v.slug.replace(/-/g, '').includes(qFirst.replace(/[^a-z0-9]/g, ''));

  const attempts: Array<{ url: string; init?: RequestInit }> = [
    // Azerbaijani consumer API (most reliable for az locale)
    { url: `https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1/pages/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}&language=az` },
    { url: `https://consumer-api.wolt.com/v1/pages/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}` },
    { url: `https://restaurant-api.wolt.com/v1/pages/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}&target=venues` },
    { url: 'https://restaurant-api.wolt.com/v1/pages/search', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, lat, lon, target: 'venues' }) } },
    { url: `https://restaurant-api.wolt.com/v1/search?q=${encodeURIComponent(q)}&lat=${lat}&lon=${lon}` },
  ];
  const errors: string[] = [];
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, { ...a.init, headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'az,en', ...(a.init?.headers ?? {}) }, cache: 'no-store' });
      if (!res.ok) { errors.push(`${res.status} ${a.url.split('?')[0]}`); continue; }
      const all = collectVenues(await res.json());
      if (!all.length) { errors.push(`boş (struct): ${a.url.split('?')[0]}`); continue; }
      const venues = all.filter(matchesQuery);
      // If name filter yields nothing, fall back to all venues (admin can pick)
      const result = venues.length ? venues : all;
      return { venues: result, endpoint: a.url };
    } catch (e) {
      errors.push((e as Error).message.slice(0, 80));
    }
  }
  throw new Error(`Wolt axtarışı nəticə vermədi. ${errors.join(' | ')}`);
}

/** Venue details (address + coordinates) for a slug, used when search results lack them. */
export async function fetchWoltVenueInfo(slug: string): Promise<WoltVenue | null> {
  try {
    const j = await getJson(`https://restaurant-api.wolt.com/v3/venues/slug/${encodeURIComponent(slug)}`);
    const v = collectVenues(j).find((x) => x.slug === slug) ?? collectVenues(j)[0];
    return v ?? null;
  } catch {
    return null;
  }
}
