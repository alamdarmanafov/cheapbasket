import { Product, Store, StoreId, catalog } from '@/data/products';

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
  /** The pick — cheapest store that can supply the whole basket (or the most of it). */
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

export function optimize(lines: BasketLine[], stores: Store[] = catalog.stores): Optimization {
  if (lines.length === 0 || stores.length === 0) return { ranked: [], best: null, worst: null, saving: 0, cheapestSplitTotal: 0 };

  const ranked: StoreTotal[] = stores
    .map((store) => {
      let total = 0;
      const missing: BasketLine[] = [];
      for (const l of lines) {
        const c = lineCost(l, store.id);
        if (c == null) missing.push(l);
        else total += c;
      }
      return { store, total, missing };
    })
    .sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);

  const best = ranked[0] ?? null;
  const full = ranked.filter((r) => r.missing.length === 0);
  const worst = full.length > 1 ? full[full.length - 1] : null;
  const saving = best && worst ? Math.max(0, worst.total - best.total) : 0;

  let cheapestSplitTotal = 0;
  for (const l of lines) {
    const costs = stores.map((s) => lineCost(l, s.id)).filter((c): c is number => c != null);
    if (costs.length) cheapestSplitTotal += Math.min(...costs);
  }

  return { ranked, best, worst, saving, cheapestSplitTotal };
}

export interface SplitSide {
  store: Store;
  lines: BasketLine[];
  total: number;
}

export interface SplitPlan {
  a: SplitSide;
  b: SplitSide;
  total: number;
  /** What the best single store would have cost for the same coverage. */
  single: number;
  saving: number;
}

/**
 * Two stores instead of one, when that is worth the second trip.
 *
 * Every pair of stores is tried; each line goes to whichever of the two
 * sells it cheaper. A pair only counts if it covers at least what the best
 * single store covers, and both halves carry something. The plan is offered
 * when it beats the best single store by `minSaving`; below that the second
 * trip costs more than it saves.
 */
export function splitPlan(lines: BasketLine[], stores: Store[] = catalog.stores, minSaving = 2): SplitPlan | null {
  if (lines.length < 2 || stores.length < 2) return null;
  const single = optimize(lines, stores).best;
  if (!single) return null;
  let best: SplitPlan | null = null;
  for (let i = 0; i < stores.length; i++) {
    for (let j = i + 1; j < stores.length; j++) {
      const a: BasketLine[] = [], b: BasketLine[] = [];
      let ta = 0, tb = 0, missing = 0;
      for (const l of lines) {
        const ca = lineCost(l, stores[i].id), cb = lineCost(l, stores[j].id);
        if (ca == null && cb == null) { missing++; continue; }
        if (cb == null || (ca != null && ca <= cb)) { a.push(l); ta += ca as number; }
        else { b.push(l); tb += cb; }
      }
      if (missing > single.missing.length || !a.length || !b.length) continue;
      const total = ta + tb;
      if (!best || total < best.total) best = { a: { store: stores[i], lines: a, total: ta }, b: { store: stores[j], lines: b, total: tb }, total, single: single.total, saving: single.total - total };
    }
  }
  return best && best.saving >= minSaving ? best : null;
}
