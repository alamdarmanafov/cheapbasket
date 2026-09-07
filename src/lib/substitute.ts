import { Product, StoreId, catalog } from '@/data/products';

const norm = (s: string) =>
  s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').split(/[^a-z0-9]+/).filter((t) => t.length > 1);

/**
 * Closest replacement for a product that the chosen store does not sell:
 * same category, sold there, ranked by shared name words, then price closeness. Plus feature in the UI.
 */
export function suggestSubstitute(product: Product, storeId: StoreId): { product: Product; price: number } | null {
  const want = new Set([...norm(product.name), ...norm(product.brand)]);
  const ref = Object.values(product.prices).filter((v): v is number => v != null);
  const refPrice = ref.length ? Math.min(...ref) : null;
  let best: { product: Product; price: number; score: number } | null = null;
  for (const p of catalog.products) {
    if (p.id === product.id || p.category !== product.category) continue;
    const price = p.prices[storeId];
    if (price == null) continue;
    const words = new Set([...norm(p.name), ...norm(p.brand)]);
    let score = 0;
    for (const w of want) if (words.has(w)) score += 2;
    if (p.size === product.size) score += 1;
    if (refPrice != null) score -= Math.min(2, Math.abs(price - refPrice) / Math.max(0.5, refPrice));
    if (!best || score > best.score) best = { product: p, price, score };
  }
  return best ? { product: best.product, price: best.price } : null;
}
