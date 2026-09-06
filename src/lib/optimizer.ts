import { Product, STORE_IDS, STORES, StoreId, Store } from '@/data/products';

export interface BasketLine {
  product: Product;
  qty: number;
}

export interface StoreTotal {
  store: Store;
  /** Total of the lines this store can supply. */
  total: number;
  /** Lines this store cannot supply. */
  missing: BasketLine[];
}

export interface Optimization {
  /** Every store, best first: full coverage before partial, then cheapest. */
  ranked: StoreTotal[];
  /** The AI's pick — the cheapest store that can supply the whole basket (or the most of it). */
  best: StoreTotal | null;
  /** Most expensive full-coverage store — what "one supermarket" would cost at worst. */
  worst: StoreTotal | null;
  /** worst.total − best.total (0 when there is no comparison). */
  saving: number;
  /** Sum of the cheapest available price for every line (multi-store, informational). */
  cheapestSplitTotal: number;
}

const lineCost = (l: BasketLine, store: StoreId) => {
  const p = l.product.prices[store];
  return p == null ? null : p * l.qty;
};

export function optimize(lines: BasketLine[]): Optimization {
  if (lines.length === 0) return { ranked: [], best: null, worst: null, saving: 0, cheapestSplitTotal: 0 };

  const ranked: StoreTotal[] = STORE_IDS.map((id) => {
    let total = 0;
    const missing: BasketLine[] = [];
    for (const l of lines) {
      const c = lineCost(l, id);
      if (c == null) missing.push(l);
      else total += c;
    }
    return { store: STORES[id], total, missing };
  }).sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);

  const best = ranked[0] ?? null;
  const full = ranked.filter((r) => r.missing.length === 0);
  const worst = full.length > 1 ? full[full.length - 1] : null;
  const saving = best && worst ? Math.max(0, worst.total - best.total) : 0;

  let cheapestSplitTotal = 0;
  for (const l of lines) {
    const costs = STORE_IDS.map((s) => lineCost(l, s)).filter((c): c is number => c != null);
    if (costs.length) cheapestSplitTotal += Math.min(...costs);
  }

  return { ranked, best, worst, saving, cheapestSplitTotal };
}
