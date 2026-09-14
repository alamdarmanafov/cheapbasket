import { fetchAnySource, WoltItem, splitName } from './wolt';
import { normalizeGtin } from './gtin';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One product, every store's feed: what the feed calls it, and for how much.
 *
 * Sync recognises a product by barcode or by an exact name; the long tail is
 * the item each feed spells its own way. This ranks a feed's items by how
 * many words they share with ours, so the admin sees "Gilezi yumurta ağ iri
 * 10 əd · 0.18 ₼" next to "Giləzi Ağ Yumurta İri" and links them in a click.
 */
export interface Candidate { ext_id: string; name: string; price: number; regular_price: number | null; barcode: string | null; image_url: string | null; score: number; exactBarcode: boolean; /** From the store's site search rather than a feed: no durable link. */ web?: boolean }

const fold = (s: string) =>
  s.toLowerCase().replace(/i̇/g, 'i')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/(\d+)[.,](\d+)/g, '$1_$2').replace(/[^a-z0-9_%]+/g, ' ').trim();

const STOP = new Set(['ve', 'və', 'ile', 'the', 'of']);
export const tokens = (s: string) => fold(s).split(/\s+/).filter((t) => t && !STOP.has(t));

/** "1 L" = "1L" = "1000 ml"; empty when the size cannot be read. */
export function sizeKey(size: string | null | undefined): string {
  const s = fold(size ?? '').replace('_', '.');
  const pack = s.match(/^(\d+)\s*[x×*]\s*(.+)$/);
  const mult = pack ? Number(pack[1]) : 1;
  const m = (pack ? pack[2] : s).match(/(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (!m) return '';
  const n = Number(m[1]) * mult;
  const u = m[2];
  if (/^(kq|kg)$/.test(u)) return `${n}kg`;
  if (/^(qr|q|g|gr)$/.test(u)) return `${n / 1000}kg`;
  if (/^(l|lt|litr)$/.test(u)) return `${n}l`;
  if (/^ml$/.test(u)) return `${n / 1000}l`;
  if (/^(ed|eded|pcs|pc|st)$/.test(u)) return `${n}pc`;
  return '';
}

/** 0..1: shared words over all words, with the size as a tie-breaker either way. */
export function similarity(ours: { brand: string; name: string; size: string }, theirs: { name: string }): number {
  const a = new Set(tokens(`${ours.brand} ${ours.name}`));
  const sp = splitName(theirs.name);
  const b = new Set(tokens(`${sp.brand} ${sp.name}`));
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  let s = shared / (a.size + b.size - shared);
  const sa = sizeKey(ours.size), sb = sizeKey(sp.size) || sizeKey(theirs.name);
  if (sa && sb) s += sa === sb ? 0.15 : -0.25;
  return Math.max(0, Math.min(1, s));
}

// A feed is a few thousand items behind one request; the second product the
// admin looks up within the hour should not fetch it again.
const cache = new Map<string, { at: number; items: WoltItem[]; venue: string }>();
const TTL = 60 * 60 * 1000;

/** The words to search a site with: brand and name, not the size (sites index it their own way). */
export function searchQuery(p: { brand: string; name: string }): string {
  return `${p.brand} ${p.name}`.replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** The template with the words in place, or null when it has no {q}. */
export function siteSearchUrl(template: string | null | undefined, q: string): string | null {
  const t = (template ?? '').trim();
  if (!t.includes('{q}') || !/^https?:\/\//i.test(t)) return null;
  return t.replace('{q}', encodeURIComponent(q));
}

export async function feedItems(url: string, ttl = TTL, limits?: { maxPages?: number; budgetMs?: number }): Promise<{ items: WoltItem[]; venue: string }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit;
  // A search results page answers on its first pages; a feed needs them all.
  const r = limits ? await (await import('./generic-import')).fetchGenericPage(url, limits) : await fetchAnySource(url);
  const entry = { at: Date.now(), items: r.items, venue: r.venue };
  cache.set(url, entry);
  return entry;
}

/** The best few matches for our product in one feed. */
export function rank(product: { brand: string; name: string; size: string; barcode: string | null }, items: WoltItem[], limit = 3): Candidate[] {
  const bc = normalizeGtin(product.barcode);
  const out: Candidate[] = [];
  for (const it of items) {
    if (it.price == null) continue;
    const exactBarcode = !!bc && normalizeGtin(it.barcode) === bc;
    const score = exactBarcode ? 1 : similarity(product, it);
    if (score < 0.3) continue;
    out.push({ ext_id: it.ext_id, name: it.name, price: it.price, regular_price: it.regular_price, barcode: it.barcode, image_url: it.image_url, score, exactBarcode });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}

/* ---------- The whole catalogue against a whole feed ---------- */

export interface PreparedItem { it: WoltItem; tokens: Set<string>; size: string; barcode: string | null }

/** Tokenise a feed once: the batch pass scores every product against it. */
export function prepareItems(items: WoltItem[]): { prepared: PreparedItem[]; byToken: Map<string, number[]>; byBarcode: Map<string, number> } {
  const prepared: PreparedItem[] = [];
  const byToken = new Map<string, number[]>();
  const byBarcode = new Map<string, number>();
  for (const it of items) {
    if (it.price == null) continue;
    const sp = splitName(it.name);
    const toks = new Set(tokens(`${sp.brand} ${sp.name}`));
    const idx = prepared.length;
    prepared.push({ it, tokens: toks, size: sizeKey(sp.size) || sizeKey(it.name), barcode: normalizeGtin(it.barcode) });
    for (const t of toks) byToken.set(t, [...(byToken.get(t) ?? []), idx]);
    const bc = normalizeGtin(it.barcode);
    if (bc && !byBarcode.has(bc)) byBarcode.set(bc, idx);
  }
  return { prepared, byToken, byBarcode };
}

/**
 * The best feed item for one product, from a prepared feed. Only items that
 * share a word are looked at, which is what keeps a 3000 × 3000 pass to a
 * few seconds.
 */
export function bestMatch(product: { brand: string; name: string; size: string; barcode: string | null }, feed: ReturnType<typeof prepareItems>): { idx: number; score: number; exactBarcode: boolean } | null {
  const bc = normalizeGtin(product.barcode);
  if (bc && feed.byBarcode.has(bc)) return { idx: feed.byBarcode.get(bc) as number, score: 1, exactBarcode: true };
  const a = new Set(tokens(`${product.brand} ${product.name}`));
  if (!a.size) return null;
  const sa = sizeKey(product.size);
  const seen = new Set<number>();
  let best: { idx: number; score: number } | null = null;
  for (const t of a) {
    for (const idx of feed.byToken.get(t) ?? []) {
      if (seen.has(idx)) continue;
      seen.add(idx);
      const b = feed.prepared[idx];
      let shared = 0;
      for (const x of a) if (b.tokens.has(x)) shared++;
      let sc = shared / (a.size + b.tokens.size - shared);
      if (sa && b.size) sc += sa === b.size ? 0.15 : -0.25;
      sc = Math.max(0, Math.min(1, sc));
      if (!best || sc > best.score) best = { idx, score: sc };
    }
  }
  return best && best.score >= 0.3 ? { ...best, exactBarcode: false } : null;
}

/**
 * A feed item is our product: the link, the price (regular and discounted
 * when the feed says so), a history row, and a barcode we lacked.
 * Shared by the finder's "Bu odur", the review queue and the batch pass.
 */
export async function applyLink(db: SupabaseClient, b: { product_id: string; store_id: string; ext_id: string; price: number; regular_price?: number | null; barcode?: string | null }): Promise<void> {
  const now = new Date().toISOString();
  if (!b.ext_id.startsWith('web:')) {
    const { error: e1 } = await db.from('product_links').upsert({ store_id: b.store_id, ext_id: b.ext_id, product_id: b.product_id }, { onConflict: 'store_id,ext_id' });
    if (e1) throw e1;
  }
  const regular = b.regular_price != null && Number(b.regular_price) > Number(b.price) ? Number(b.regular_price) : null;
  const row: { product_id: string; store_id: string; price: number; discount_price: number | null; source: string; updated_at: string } = {
    product_id: b.product_id, store_id: b.store_id,
    price: regular ?? Number(b.price), discount_price: regular ? Number(b.price) : null, source: 'feed', updated_at: now,
  };
  const { error: e2 } = await db.from('prices').upsert(row, { onConflict: 'product_id,store_id' });
  if (e2) throw e2;
  await db.from('price_history').insert({ ...row, recorded_at: now }).then(() => undefined, () => undefined);
  const bc = normalizeGtin(b.barcode);
  if (bc) {
    const { data: taken } = await db.from('products').select('id').eq('barcode', bc).neq('id', b.product_id).maybeSingle();
    if (!taken) await db.from('products').update({ barcode: bc }).eq('id', b.product_id).is('barcode', null);
  }
}
