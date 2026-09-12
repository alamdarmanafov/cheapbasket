import { fetchAnySource, WoltItem, splitName } from './wolt';
import { normalizeGtin } from './gtin';

/**
 * One product, every store's feed: what the feed calls it, and for how much.
 *
 * Sync recognises a product by barcode or by an exact name; the long tail is
 * the item each feed spells its own way. This ranks a feed's items by how
 * many words they share with ours, so the admin sees "Gilezi yumurta ağ iri
 * 10 əd · 0.18 ₼" next to "Giləzi Ağ Yumurta İri" and links them in a click.
 */
export interface Candidate { ext_id: string; name: string; price: number; regular_price: number | null; barcode: string | null; image_url: string | null; score: number; exactBarcode: boolean }

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

export async function feedItems(url: string): Promise<{ items: WoltItem[]; venue: string }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const r = await fetchAnySource(url);
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
