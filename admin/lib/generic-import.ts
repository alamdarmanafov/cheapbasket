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

/** Products of one page: JSON-LD → OpenGraph → AI over the text. */
async function parsePage(html: string, base: URL, allowAI: boolean): Promise<{ items: WoltItem[]; source: string }> {
  let items = fromJsonLd(html, base);
  let source = 'json-ld';
  if (items.length < 3) {
    const og = fromOpenGraph(html, base);
    if (og.length) { items = [...items, ...og]; source = items.length > og.length ? 'json-ld+og' : 'og'; }
  }
  if (items.length < 3 && allowAI) {
    const text = htmlToText(html);
    if (text.length < 200) throw new Error('Səhifə boş gəldi: məhsullar JavaScript ilə yüklənir, serverdən oxumaq mümkün deyil. Saytın kateqoriya səhifəsini və ya JSON API linkini sına.');
    const ai = await fromAI(text, base);
    if (ai.length) { items = ai; source = 'ai'; }
  }
  return { items, source };
}

/**
 * Next page of a paginated listing: <link rel="next">, an <a rel="next">, a link whose page number is
 * current+1 (?page=N, &p=N, /page/N), or — when the page carries a page parameter already — the same URL with it incremented.
 */
function nextPageUrl(html: string, current: URL, pageNo: number): URL | null {
  const abs = (h: string) => { try { const u = new URL(h.replace(/&amp;/g, '&'), current); return u.hostname === current.hostname ? u : null; } catch { return null; } };
  const rel = html.match(/<(?:link|a)[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? html.match(/<(?:link|a)[^>]+href=["']([^"']+)["'][^>]+rel=["']next["']/i)?.[1];
  if (rel) { const u = abs(rel); if (u && u.toString() !== current.toString()) return u; }
  const want = pageNo + 1;
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const h = m[1].replace(/&amp;/g, '&');
    if (new RegExp(`(?:[?&](?:page|p|pg|pagina)=${want}(?:&|$)|/page/${want}(?:/|$|\\?))`).test(h)) { const u = abs(h); if (u) return u; }
  }
  for (const key of ['page', 'p', 'pg']) {
    if (current.searchParams.has(key) && /^\d+$/.test(current.searchParams.get(key) ?? '')) {
      const u = new URL(current.toString()); u.searchParams.set(key, String(want)); return u;
    }
  }
  const m = current.pathname.match(/^(.*\/page\/)(\d+)(\/?)$/);
  if (m) { const u = new URL(current.toString()); u.pathname = `${m[1]}${want}${m[3]}`; return u; }
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
    url = nextPageUrl(html, url, pageNo);
    pageNo += 1;
  }
  if (!seen.size) throw new Error(`${first.hostname}: məhsul tapılmadı`);
  const list = [...seen.values()];
  const note = pages > 1 ? ` · ${pages} səhifə` : '';
  const cap = seen.size >= MAX_ITEMS ? ` · limit ${MAX_ITEMS}` : Date.now() - started >= TIME_BUDGET_MS ? ' · vaxt limiti (növbəti səhifədən davam et)' : '';
  return { venue: first.hostname, items: list, categories: [...new Set(list.map((i) => i.category).filter((c): c is string => !!c))], debug: { endpoint: `${[...sources].join('+')} · ${first.toString()}${note}${cap}`, topKeys: [], sampleKeys: [] } };
}
