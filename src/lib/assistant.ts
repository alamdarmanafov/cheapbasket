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
  const essentials = ['sutas-sud-1l', 'yumurta-10', 'corek-tandir', 'duyu-1kg', 'toyuq-file-1kg', 'pomidor-1kg', 'banan-1kg', 'sirab-1-5l'];
  const picked: Product[] = [];
  let total = 0;
  const tryAdd = (p: Product | undefined) => {
    if (!p) return;
    const price = cheapest(p).price ?? 0;
    if (total + price <= budget) {
      picked.push(p);
      total += price;
    }
  };
  essentials.forEach((id) => tryAdd(getProduct(id)));
  catalog.products.filter((p) => !picked.includes(p))
    .sort((a, b) => (cheapest(a).price ?? 0) - (cheapest(b).price ?? 0))
    .forEach(tryAdd);
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
    const base = getProduct(context?.productId ?? 'nescafe-gold-95') ?? catalog.products[0];
    const alts = cheaperAlternatives(base, 3);
    const list = alts.length > 0 ? alts : catalog.products.filter((p) => p.id !== base.id).slice(0, 3);
    return {
      text: `${list.length} alternativ tapdım. Fərq ən ucuz qiymətə görə hesablanıb.`,
      card: { kind: 'alternatives', title: `${base.brand} ${base.name} əvəzinə`, base, products: list },
      chips: ['Birincini səbətə əlavə et', 'Başqa kateqoriya'],
    };
  }

  if (q.includes('seher') || q.includes('breakfast')) {
    const ids = ['sutas-sud-1l', 'yumurta-10', 'corek-tandir', 'pendir-atena-400', 'kere-yagi-200'];
    const products = ids.map(getProduct).filter((p): p is Product => !!p);
    const total = products.reduce((a, p) => a + (cheapest(p).price ?? 0), 0);
    return {
      text: `Səhər yeməyi üçün ${products.length} məhsul təklif edirəm. Ən ucuz seçimlə cəmi ${total.toFixed(2)} ₼.`,
      card: { kind: 'products', title: 'Səhər yeməyi', products, total },
      chips: ['Hamısını səbətə əlavə et', 'Daha sağlam variant'],
    };
  }

  if (q.includes('market') || q.includes('hansi')) {
    return {
      text: 'Bu həftə süd məhsulları və çörəkdə Araz, içkilərdə Bazarstore, qəhvə və makaronda Bravo daha ucuzdur. Səbətini AI ilə bölsən orta hesabla 8–12% qənaət edirsən.',
      chips: ['Səbətimi optimallaşdır', '50 manatlıq səbət hazırla'],
    };
  }

  return {
    text: 'Başa düşdüm. Büdcə, məhsul adı və ya kateqoriya yaz — sənə ən sərfəli səbəti hazırlayım.',
    chips: STARTER_PROMPTS.slice(0, 2),
  };
}
