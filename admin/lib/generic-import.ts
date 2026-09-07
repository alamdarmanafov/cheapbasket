import type { WoltItem, WoltResult } from './wolt';

/**
 * Import products + prices from any shop page (not Wolt):
 *  1. schema.org JSON-LD (Product / ItemList / OfferCatalog) and OpenGraph product tags — free, exact.
 *  2. Fallback: the page text goes to OpenAI and comes back as a JSON product list (≈ 0.01 $ per page).
 * Pages rendered only by JavaScript (no products in the HTML) cannot be read server-side.
 */
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

/** "2,05 ₼", "2.05 AZN", "2 man 5 q" → 2.05 */
export function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  const s = str(v);
  if (!s) return null;
  const m = s.replace(/\s/g, '').match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/article|\/section)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Products embedded in __NEXT_DATA__ / __NUXT_DATA__ / window.__INITIAL_STATE__ JSON blobs.
 * These appear on Next.js / Nuxt / other SSR frameworks and contain the full product list
 * without needing AI. We walk the JSON recursively looking for arrays that look like product lists.
 */
function fromEmbeddedJson(html: string, base: URL): WoltItem[] {
  // Extract all large JSON-like script payloads
  const blobs: string[] = [];
  for (const m of html.matchAll(/<script[^>]*id=["'](?:__NEXT_DATA__|__NUXT_DATA__|__INITIAL_STATE__|__REDUX_STATE__|__APP_STATE__|initial-state)["'][^>]*>([\s\S]*?)<\/script>/gi)) blobs.push(m[1]);
  // Also: window.__X__ = {...} / window.__X__ = [...] assignments
  for (const m of html.matchAll(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]{200,}?\}|\[[\s\S]{200,}?\])\s*;/g)) blobs.push(m[1]);

  const out: WoltItem[] = [];
  const seen = new Set<string>();

  const tryItem = (o: Obj) => {
    const name = str(o.name ?? o.title ?? o.product_name ?? o.productName);
    const price = parsePrice(o.price ?? o.sell_price ?? o.selling_price ?? o.current_price ?? o.salePrice ?? o.price_value ?? o.price_az ?? o.priceCurrent);
    if (!name || price == null || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const old = parsePrice(o.old_price ?? o.compare_price ?? o.comparePrice ?? o.regular_price ?? o.originalPrice ?? o.price_old ?? o.crossed_price);
    const img = str(o.image ?? o.image_url ?? o.imageUrl ?? o.thumbnail ?? o.photo ?? o.cover ?? o.main_image ?? o.picture);
    const absImg = img ? (() => { try { return new URL(img, base).toString(); } catch { return null; } })() : null;
    const barcode = str(o.barcode ?? o.ean ?? o.ean13 ?? o.gtin ?? o.gtin13 ?? o.upc);
    const id = str(o.id ?? o.uuid ?? o.sku ?? o.slug ?? o.product_id ?? o.productId ?? o.guid) ?? name;
    out.push({
      ext_id: `${base.hostname}-${id}`,
      name,
      description: str(o.description ?? o.short_description),
      price,
      regular_price: old != null && old > price ? old : null,
      barcode: barcode && /^\d{8,14}$/.test(barcode) ? barcode : null,
      image_url: absImg,
      category: str(o.category ?? o.category_name ?? o.categoryName ?? obj(o.category)?.name) ?? str(obj(arr(o.categories)[0])?.name),
    });
  };

  const walk = (v: unknown, depth: number) => {
    if (depth > 12) return;
    if (Array.isArray(v)) {
      // If this array looks like a product list (≥3 items with name+price), process it
      const sample = v.slice(0, 3).map((x) => obj(x)).filter(Boolean) as Obj[];
      const looksLikeProducts = sample.length >= 2 && sample.every((o) => {
        const hasName = !!(o.name ?? o.title ?? o.product_name ?? o.productName);
        const hasPrice = parsePrice(o.price ?? o.sell_price ?? o.selling_price ?? o.current_price ?? o.priceCurrent) != null;
        return hasName && hasPrice;
      });
      if (looksLikeProducts) { v.forEach((x) => { const o = obj(x); if (o) tryItem(o); }); return; }
      v.forEach((x) => walk(x, depth + 1));
      return;
    }
    const o = obj(v);
    if (!o) return;
    for (const val of Object.values(o)) walk(val, depth + 1);
  };

  for (const blob of blobs) {
    try { walk(JSON.parse(blob), 0); } catch { /* broken JSON */ }
    if (out.length > 0) break; // first blob that yields products is enough
  }
  return out;
}

/**
 * Schema.org microdata (itemprop attributes) — used by older / PHP-based shop platforms
 * that don't emit JSON-LD.  Finds every [itemtype*="Product"] block and reads
 * itemprop="name", "price", "image", "sku", "description".
 */
function fromMicrodata(html: string, base: URL): WoltItem[] {
  const out: WoltItem[] = [];
  // Split on itemtype containing "Product"
  const blocks = html.split(/<[^>]+itemtype=["'][^"']*Product[^"']*["'][^>]*>/i).slice(1);
  for (const block of blocks) {
    // Read up to the end of this product block (next itemtype or 3000 chars)
    const chunk = block.slice(0, 3000);
    const iProp = (p: string) =>
      chunk.match(new RegExp(`itemprop=["']${p}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
      chunk.match(new RegExp(`itemprop=["']${p}["'][^>]*>([^<]{1,120})<`, 'i'))?.[1]?.trim() ??
      null;
    const name = iProp('name');
    const price = parsePrice(iProp('price'));
    if (!name || price == null) continue;
    const img = iProp('image') ?? chunk.match(/itemprop=["']image["'][^>]+src=["']([^"']+)["']/i)?.[1] ?? null;
    out.push({
      ext_id: iProp('sku') ?? iProp('productID') ?? `${base.hostname}-${name}`,
      name,
      description: iProp('description'),
      price,
      regular_price: null,
      barcode: null,
      image_url: img ? (() => { try { return new URL(img, base).toString(); } catch { return null; } })() : null,
      category: null,
    });
  }
  return out;
}

/** Products from schema.org JSON-LD blocks. */
function fromJsonLd(html: string, base: URL): WoltItem[] {
  const out: WoltItem[] = [];
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const walk = (v: unknown) => {
    const o = obj(v);
    if (!o) { arr(v).forEach(walk); return; }
    const type = arr(o['@type']).map(String);
    if (type.includes('Product')) {
      const offers = arr(o.offers).map(obj).filter(Boolean) as Obj[];
      const offer = offers[0];
      const price = parsePrice(offer?.price ?? offer?.lowPrice ?? o.price);
      const name = str(o.name);
      if (name && price != null) {
        const img = str(arr(o.image)[0]) ?? str(obj(arr(o.image)[0])?.url);
        out.push({
          ext_id: str(o.sku) ?? str(o.productID) ?? str(o['@id']) ?? str(o.url) ?? name,
          name,
          description: str(o.description),
          price,
          regular_price: null,
          barcode: [o.gtin13, o.gtin, o.gtin14, o.gtin12, o.gtin8].map(str).find((x) => x && /^\d{8,14}$/.test(x)) ?? null,
          image_url: img ? new URL(img, base).toString() : null,
          category: str(o.category) ?? str(obj(o.category)?.name),
        });
      }
    }
    for (const v2 of Object.values(o)) if (v2 && typeof v2 === 'object') walk(v2);
  };
  for (const b of blocks) {
    try { walk(JSON.parse(b)); } catch { /* ignore broken block */ }
  }
  return out;
}

/** Single product page described with OpenGraph product meta tags. */
function fromOpenGraph(html: string, base: URL): WoltItem[] {
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${p}["']`, 'i'))?.[1] ?? null;
  const price = parsePrice(meta('product:price:amount') ?? meta('og:price:amount'));
  const name = meta('og:title');
  if (!price || !name) return [];
  const img = meta('og:image');
  return [{ ext_id: base.toString(), name, description: meta('og:description'), price, regular_price: null, barcode: null, image_url: img ? new URL(img, base).toString() : null, category: null }];
}

/** AI extraction over the visible text (works for any shop layout that renders server-side). */
async function fromAI(text: string, base: URL): Promise<WoltItem[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Bu səhifədə strukturlu məhsul məlumatı yoxdur; AI ilə oxumaq üçün OPENAI_API_KEY lazımdır');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You extract grocery products from the text of an Azerbaijani supermarket web page. Return JSON {"items":[{"name": string, "price": number|null, "old_price": number|null, "size": string|null, "category": string|null, "barcode": string|null}]}. Prices are in AZN (₼/AZN/man). old_price = crossed-out regular price when a discount is shown. Skip navigation, banners and anything that is not a product with a price. Keep the product name as written (brand + name). Max 300 items.' },
        { role: 'user', content: text.slice(0, 60000) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { items?: Array<{ name?: string; price?: number | string | null; old_price?: number | string | null; size?: string | null; category?: string | null; barcode?: string | null }> };
  const out: WoltItem[] = [];
  (parsed.items ?? []).forEach((it, i) => {
    const price = parsePrice(it.price);
    const old = parsePrice(it.old_price);
    const name = [it.name, it.size].filter(Boolean).join(' ').trim();
    if (!name || price == null) return;
    out.push({ ext_id: `${base.hostname}-${i}-${name.toLowerCase().replace(/[^a-z0-9əıöüşçğ]+/g, '-')}`, name, description: null, price, regular_price: old != null && old > price ? old : null, barcode: it.barcode && /^\d{8,14}$/.test(it.barcode) ? it.barcode : null, image_url: null, category: it.category ?? null });
  });
  return out;
}

const MAX_ITEMS = 1000;
const MAX_PAGES = 60;
const TIME_BUDGET_MS = 45_000; // the API route allows 60 s

async function fetchHtml(url: URL): Promise<string> {
  const res = await fetch(url.toString(), { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'az,ru,en' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Səhifə açılmadı: ${res.status} ${url.hostname}`);
  return res.text();
}

/** Products of one page: embedded-JSON → JSON-LD → microdata → OpenGraph → AI over the text. */
async function parsePage(html: string, base: URL, allowAI: boolean): Promise<{ items: WoltItem[]; source: string }> {
  // 1. Embedded SSR JSON blobs (__NEXT_DATA__, window.__INITIAL_STATE__, etc.)
  const embedded = fromEmbeddedJson(html, base);
  if (embedded.length >= 3) return { items: embedded, source: 'embedded-json' };

  // 2. schema.org JSON-LD
  const jld = fromJsonLd(html, base);
  if (jld.length >= 3) return { items: jld, source: 'json-ld' };

  // 3. schema.org microdata (itemprop) — common on older PHP / OpenCart / Magento shops
  const micro = fromMicrodata(html, base);
  if (micro.length >= 3) return { items: micro, source: 'microdata' };

  // 4. OpenGraph single-product tags
  const og = fromOpenGraph(html, base);
  if (og.length) return { items: [...jld, ...micro, ...og], source: 'og' };

  // 5. AI over the visible text (first page only)
  if (allowAI) {
    const text = htmlToText(html);
    if (text.length < 200) throw new Error('Səhifə boş gəldi: məhsullar JavaScript ilə yüklənir, serverdən oxumaq mümkün deyil. Saytın kateqoriya səhifəsini və ya JSON API linkini sına.');
    const ai = await fromAI(text, base);
    if (ai.length) return { items: ai, source: 'ai' };
  }
  return { items: [...jld, ...micro, ...og, ...embedded], source: 'partial' };
}

/**
 * Next page of a paginated listing. Strategies tried in order:
 *  1. <link rel="next"> or <a rel="next"> in the HTML.
 *  2. An <a href> whose URL contains page=N+1 / p=N+1 / /page/N+1.
 *  3. The current URL already has a page/p/pg param → increment it.
 *  4. The current URL pathname ends in /page/N → increment it.
 *  5. Offset-based pagination: ?offset=N or ?start=N or ?from=N or ?skip=N in the HTML or current URL.
 *  6. Probe fallback: page 1 with items but no link found → guess ?page=2.
 */
function nextPageUrl(html: string, current: URL, pageNo: number, prevCount = 0): URL | null {
  const abs = (h: string) => { try { const u = new URL(h.replace(/&amp;/g, '&'), current); return u.hostname === current.hostname ? u : null; } catch { return null; } };

  // 1. rel=next
  const rel = html.match(/<(?:link|a)[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? html.match(/<(?:link|a)[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i)?.[1];
  if (rel) { const u = abs(rel); if (u && u.toString() !== current.toString()) return u; }

  // 2. href with page number pattern
  const want = pageNo + 1;
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const h = m[1].replace(/&amp;/g, '&');
    if (new RegExp(`(?:[?&](?:page|p|pg|pagina|sayfa|stranka|seite)=${want}(?:&|$)|/page/${want}(?:/|$|\\?))`).test(h)) { const u = abs(h); if (u) return u; }
  }

  // 3. current URL already has a page param → increment
  for (const key of ['page', 'p', 'pg', 'sayfa', 'stranka']) {
    if (current.searchParams.has(key) && /^\d+$/.test(current.searchParams.get(key) ?? '')) {
      const u = new URL(current.toString()); u.searchParams.set(key, String(want)); return u;
    }
  }

  // 4. pathname /page/N
  const pm = current.pathname.match(/^(.*\/page\/)(\d+)(\/?)$/);
  if (pm) { const u = new URL(current.toString()); u.pathname = `${pm[1]}${want}${pm[3]}`; return u; }

  // 5. Offset-based: look for ?offset=N, ?start=N, ?from=N, ?skip=N either in current URL or in hrefs
  const offsetKeys = ['offset', 'start', 'from', 'skip'];
  for (const key of offsetKeys) {
    const cur = current.searchParams.get(key);
    if (cur && /^\d+$/.test(cur)) {
      const u = new URL(current.toString());
      u.searchParams.set(key, String(Number(cur) + prevCount));
      return u;
    }
  }
  // Look for an offset href in the HTML where offset = prevCount (i.e. the next page link)
  if (prevCount > 0) {
    for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
      const h = m[1].replace(/&amp;/g, '&');
      for (const key of offsetKeys) {
        if (new RegExp(`[?&]${key}=${prevCount}(?:&|$)`).test(h)) { const u = abs(h); if (u) return u; }
      }
    }
  }

  // 6. Probe fallback: if this was page 1 and we got items, guess there might be a page 2
  if (pageNo === 1 && prevCount > 0) {
    const u = new URL(current.toString());
    u.searchParams.set('page', '2');
    return u;
  }

  return null;
}

/**
 * Import from any shop page. Follows the listing's pagination (up to MAX_ITEMS products / MAX_PAGES pages / 45 s)
 * and returns one entry per product (same name or id on later pages is dropped).
 */
export async function fetchGenericPage(input: string): Promise<WoltResult> {
  const started = Date.now();
  const first = new URL(input.trim());
  const seen = new Map<string, WoltItem>();
  const ids = new Set<string>();
  const visited = new Set<string>();
  const sources = new Set<string>();
  let url: URL | null = first;
  let pageNo = 1;
  let pages = 0;
  const pageParam = first.searchParams.get('page') ?? first.searchParams.get('p');
  if (pageParam && /^\d+$/.test(pageParam)) pageNo = Number(pageParam);
  while (url && pages < MAX_PAGES && seen.size < MAX_ITEMS && Date.now() - started < TIME_BUDGET_MS) {
    if (visited.has(url.toString())) break;
    visited.add(url.toString());
    let html: string;
    try { html = await fetchHtml(url); } catch (e) { if (pages === 0) throw e; break; } // a missing later page ends the listing
    // AI extraction is allowed on the first page only (later pages of a structured site are structured too).
    const { items, source } = await parsePage(html, url, pages === 0);
    pages += 1;
    sources.add(source);
    let added = 0;
    for (const it of items) {
      const k = it.name.toLowerCase();
      if (seen.has(k) || ids.has(it.ext_id)) continue;
      seen.set(k, it); ids.add(it.ext_id); added += 1;
      if (seen.size >= MAX_ITEMS) break;
    }
    if (pages > 1 && added === 0) break; // a page with nothing new = end of the listing
    if (!items.length) break;
    url = nextPageUrl(html, url, pageNo, items.length);
    pageNo += 1;
  }
  if (!seen.size) throw new Error(`${first.hostname}: məhsul tapılmadı`);
  const list = [...seen.values()];
  const note = pages > 1 ? ` · ${pages} səhifə` : '';
  const cap = seen.size >= MAX_ITEMS ? ` · limit ${MAX_ITEMS}` : Date.now() - started >= TIME_BUDGET_MS ? ' · vaxt limiti (növbəti səhifədən davam et)' : '';
  return { venue: first.hostname, items: list, categories: [...new Set(list.map((i) => i.category).filter((c): c is string => !!c))], debug: { endpoint: `${[...sources].join('+')} · ${first.toString()}${note}${cap}`, topKeys: [], sampleKeys: [] } };
}
