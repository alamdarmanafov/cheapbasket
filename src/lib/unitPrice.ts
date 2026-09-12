/**
 * Price per kilo, litre or piece, from the size printed on the packet.
 *
 * "500 q" at 2.40 and "1 kq" at 4.20 are the same product at 4.80 and 4.20 a
 * kilo — the comparison a price app exists for, and one the shopper cannot do
 * in the aisle. The size field is free text in whatever the source wrote
 * (Azerbaijani, Russian, Turkish, English), so this reads the common forms and
 * says nothing when it cannot.
 */
export type Unit = 'kg' | 'l' | 'pc';

interface Size { qty: number; unit: Unit }

// Whole-token matches. `\\b` is ASCII-only in JavaScript, so it never fires
// after a Cyrillic letter — and "ml" would have matched the "l" inside it.
const WEIGHT_KG = /^(kq|kg|кг)$/i;
const WEIGHT_G = /^(qr|q|g|gr|qram|gram|г|гр)$/i;
const VOL_L = /^(lt|l|litr|liter|litre|л)$/i;
const VOL_ML = /^(ml|мл)$/i;
const PIECE = /^(ədəd|əd|pcs|pc|adet|ad|шт)$/i;

const num = (s: string) => Number(s.replace(',', '.'));

export function parseSize(size: string | null | undefined): Size | null {
  const s = (size ?? '').trim().toLowerCase();
  if (!s) return null;
  // A multipack: "6 x 1 L", "10×50 q", "3x200ml".
  const pack = s.match(/^(\d+)\s*[x×*]\s*(.+)$/);
  const mult = pack ? Number(pack[1]) : 1;
  const body = pack ? pack[2] : s;
  const m = body.match(/(\d+(?:[.,]\d+)?)\s*([a-zəğıöşçа-я.]+)/i);
  if (!m) return null;
  const n = num(m[1]) * mult;
  const u = m[2].replace(/\.$/, '');
  if (!Number.isFinite(n) || n <= 0) return null;
  if (WEIGHT_KG.test(u)) return { qty: n, unit: 'kg' };
  if (WEIGHT_G.test(u)) return { qty: n / 1000, unit: 'kg' };
  if (VOL_L.test(u)) return { qty: n, unit: 'l' };
  if (VOL_ML.test(u)) return { qty: n / 1000, unit: 'l' };
  if (PIECE.test(u)) return { qty: n, unit: 'pc' };
  return null;
}

/** Price per unit, or null when the size cannot be read or is a single piece (where it would just repeat the price). */
export function unitPrice(price: number | null | undefined, size: string | null | undefined): { per: number; unit: Unit } | null {
  if (price == null) return null;
  const s = parseSize(size);
  if (!s) return null;
  if (s.unit === 'pc' && s.qty === 1) return null;
  return { per: price / s.qty, unit: s.unit };
}
