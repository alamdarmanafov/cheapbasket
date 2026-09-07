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
  'Mənə 50 manatlıq həftəlik ərzaq səbəti hazırla',
  'Bu məhsulun daha ucuz alternativini tap',
  'Səhər yeməyi üçün nə alım?',
  'Bu həftə hansı market daha ucuzdur?',
];

const norm = (s: string) => s.toLowerCase().replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c');

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
  const budgetMatch = q.match(/(\d+)\s*(manat|azn|₼|man)/);

  if (budgetMatch) {
    const budget = Number(budgetMatch[1]);
    const { products, total } = budgetBasket(budget);
    return {
      text: `${budget} ₼ büdcənə uyğun ${products.length} məhsul seçdim. Ən ucuz marketlərdən alsan cəmi ${total.toFixed(2)} ₼ olur.`,
      card: { kind: 'products', title: 'Həftəlik səbət', products, total, budget },
      chips: ['Hamısını səbətə əlavə et', 'Daha ucuz variant', 'Ət olmasın'],
    };
  }

  if (q.includes('alternativ') || q.includes('ucuz')) {
    const base = (context?.productId ? getProduct(context.productId) : undefined) ?? catalog.products[0];
    if (!base) return { text: 'Kataloqda hələ məhsul yoxdur.' };
    const alts = cheaperAlternatives(base, 3);
    const list = alts.length > 0 ? alts : catalog.products.filter((p) => p.id !== base.id).slice(0, 3);
    return {
      text: `${list.length} alternativ tapdım. Fərq ən ucuz qiymətə görə hesablanıb.`,
      card: { kind: 'alternatives', title: `${base.brand} ${base.name} əvəzinə`, base, products: list },
      chips: ['Birincini səbətə əlavə et', 'Başqa kateqoriya'],
    };
  }

  if (q.includes('seher') || q.includes('breakfast')) {
    const wanted = ['süd', 'yumurta', 'çörək', 'pendir', 'yağ'];
    const products = catalog.products.filter((p) => wanted.some((w) => p.category.toLowerCase().includes(w) || p.name.toLowerCase().includes(w))).slice(0, 6);
    const total = products.reduce((a, p) => a + (cheapest(p).price ?? 0), 0);
    return {
      text: `Səhər yeməyi üçün ${products.length} məhsul təklif edirəm. Ən ucuz seçimlə cəmi ${total.toFixed(2)} ₼.`,
      card: { kind: 'products', title: 'Səhər yeməyi', products, total },
      chips: ['Hamısını səbətə əlavə et', 'Daha sağlam variant'],
    };
  }

  if (q.includes('market') || q.includes('hansi')) {
    // Count in how many products each store is the cheapest.
    const wins = new Map<string, number>();
    for (const p of catalog.products) {
      const c = cheapest(p);
      if (c.price != null) wins.set(c.store.name, (wins.get(c.store.name) ?? 0) + 1);
    }
    const ranked = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return { text: 'Kataloqda hələ qiymət yoxdur.' };
    return {
      text: `Hazırda ${ranked.map(([n, c]) => `${n} ${c} məhsulda`).join(', ')} ən ucuzdur. Dəqiq cavab üçün səbətini yığ, bütün səbət üzrə hesablayım.`,
      chips: ['Ən sərfəli marketi tap', '50 manatlıq səbət hazırla'],
    };
  }

  return {
    text: 'Başa düşdüm. Büdcə, məhsul adı və ya kateqoriya yaz — sənə ən sərfəli səbəti hazırlayım.',
    chips: STARTER_PROMPTS.slice(0, 2),
  };
}
