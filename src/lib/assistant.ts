import { tr } from './i18n';
import { catalog, Product, cheapest, cheaperAlternatives, getProduct } from '@/data/products';

export type AiCard =
  | { kind: 'products'; title: string; products: Product[]; total?: number; budget?: number }
  | { kind: 'alternatives'; title: string; base: Product; products: Product[] };

export interface AiReply {
  text: string;
  card?: AiCard;
  /** Suggested follow-up chips */
  chips?: string[];
}

export const STARTER_PROMPTS = [
  tr('ai.suggest1'),
  tr('ai.chipCheaper'),
  tr('ai.suggest3'),
  tr('ai.suggest4'),
];

const norm = (s: string) => s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c');

/**
 * Intent keywords in every language the app speaks.
 *
 * The suggestion chips are translated, so matching only Azerbaijani would make
 * every chip fall through to the generic reply for an English, Turkish or
 * Russian user — the assistant would look broken in three languages out of
 * four. Typed input is matched the same way, so a question asked in any of them
 * lands on the right branch.
 */
const INTENT = {
  alternatives: ['alternativ', 'ucuz', 'alternative', 'cheaper', 'alternatif', 'альтернатив', 'дешевле'],
  breakfast: ['seher', 'breakfast', 'kahvalti', 'завтрак'],
  stores: ['market', 'hansi', 'store', 'which', 'hangi', 'магазин', 'какой'],
} as const;

const hits = (q: string, words: readonly string[]) => words.some((w) => q.includes(w));

/** Greedy budget basket: essentials first, then fill with cheapest extras. */
function budgetBasket(budget: number): { products: Product[]; total: number } {
  // One product per category first (a balanced basket), then the cheapest extras.
  const picked: Product[] = [];
  let total = 0;
  const tryAdd = (p: Product | undefined) => {
    if (!p) return;
    const price = cheapest(p).price ?? 0;
    if (price > 0 && total + price <= budget) {
      picked.push(p);
      total += price;
    }
  };
  const byPrice = [...catalog.products].sort((a, b) => (cheapest(a).price ?? 0) - (cheapest(b).price ?? 0));
  const seen = new Set<string>();
  for (const p of byPrice) {
    if (seen.has(p.category)) continue;
    seen.add(p.category);
    tryAdd(p);
  }
  byPrice.filter((p) => !picked.includes(p)).forEach(tryAdd);
  return { products: picked, total };
}

export function reply(input: string, context?: { productId?: string }): AiReply {
  const q = norm(input);
  const budgetMatch = q.match(/(\d+)\s*(manat|azn|₼|man|манат)/);

  if (budgetMatch) {
    const budget = Number(budgetMatch[1]);
    const { products, total } = budgetBasket(budget);
    return {
      text: tr('ai.budgetReply', { budget, count: products.length, total: total.toFixed(2) }),
      card: { kind: 'products', title: tr('ai.weekly'), products, total, budget },
      chips: [tr('ai.addAll'), tr('ai.cheaperOpt'), tr('ai.noMeat')],
    };
  }

  if (hits(q, INTENT.alternatives)) {
    const base = (context?.productId ? getProduct(context.productId) : undefined) ?? catalog.products[0];
    if (!base) return { text: tr('ai.emptyCatalog') };
    const alts = cheaperAlternatives(base, 3);
    const list = alts.length > 0 ? alts : catalog.products.filter((p) => p.id !== base.id).slice(0, 3);
    return {
      text: tr('ai.altReply', { count: list.length }),
      card: { kind: 'alternatives', title: tr('ai.insteadOf', { product: `${base.brand} ${base.name}` }), base, products: list },
      chips: [tr('ai.addFirst'), tr('ai.otherCat')],
    };
  }

  if (hits(q, INTENT.breakfast)) {
    const wanted = ['süd', 'yumurta', 'çörək', 'pendir', 'yağ'];
    const products = catalog.products.filter((p) => wanted.some((w) => p.category.toLowerCase().includes(w) || p.name.toLowerCase().includes(w))).slice(0, 6);
    const total = products.reduce((a, p) => a + (cheapest(p).price ?? 0), 0);
    return {
      text: tr('ai.breakfastReply', { count: products.length, total: total.toFixed(2) }),
      card: { kind: 'products', title: tr('ai.breakfast'), products, total },
      chips: [tr('ai.addAll'), tr('ai.healthier')],
    };
  }

  if (hits(q, INTENT.stores)) {
    // Count in how many products each store is the cheapest.
    const wins = new Map<string, number>();
    for (const p of catalog.products) {
      const c = cheapest(p);
      if (c.price != null) wins.set(c.store.name, (wins.get(c.store.name) ?? 0) + 1);
    }
    const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return { text: tr('ai.noPrices') };
    return {
      text: tr('ai.cheapestNow', { stores: ranked.map(([n, c]) => tr('ai.storeItems', { store: n, count: c })).join(', ') }),
      chips: [tr('ai.chipFindBest'), tr('ai.chipBudget')],
    };
  }

  return {
    text: tr('ai.fallback'),
    chips: STARTER_PROMPTS.slice(0, 2),
  };
}
