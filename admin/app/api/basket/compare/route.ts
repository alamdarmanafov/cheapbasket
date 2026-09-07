import { NextResponse } from 'next/server';
import { adminDb, errText } from '@/lib/server';

export const maxDuration = 30;

interface BasketItem { product_id: string; quantity: number }

interface MarketSummary {
  market_id: string;
  market: string;
  total: number;
  available_products: number;
  missing_products: number;
  items: Array<{ product_id: string; name: string; price: number; discount_price: number | null; qty: number; subtotal: number }>;
}

interface CompareResponse {
  markets: MarketSummary[];
  best_market: string;
  best_market_id: string;
  best_price: number;
  saving: number;
  total_products: number;
}

/**
 * POST /api/basket/compare
 * Body: { products: [{ product_id, quantity }] }
 * Returns: best market + per-market price breakdown.
 * No AI — pure arithmetic. AI is only for product matching, not price decisions.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { products?: BasketItem[] };
    const items = body.products ?? [];
    if (!items.length) return NextResponse.json({ error: 'products[] boşdur' }, { status: 400 });

    const productIds = [...new Set(items.map((i) => i.product_id))];
    const db = adminDb();

    const [{ data: stores }, { data: prices }, { data: products }] = await Promise.all([
      db.from('stores').select('id, name, color, initial'),
      db.from('prices').select('product_id, store_id, price, discount_price').in('product_id', productIds),
      db.from('products').select('id, name, brand, size').in('id', productIds),
    ]);

    const productMap = new Map((products ?? []).map((p) => [p.id, p]));
    const qtyMap = new Map(items.map((i) => [i.product_id, i.quantity]));

    // price map: product_id → store_id → { price, discount_price }
    const priceMap = new Map<string, Map<string, { price: number; discount_price: number | null }>>();
    for (const r of prices ?? []) {
      if (!priceMap.has(r.product_id)) priceMap.set(r.product_id, new Map());
      priceMap.get(r.product_id)!.set(r.store_id, { price: Number(r.price ?? 0), discount_price: r.discount_price != null ? Number(r.discount_price) : null });
    }

    const marketSummaries: MarketSummary[] = [];
    for (const store of stores ?? []) {
      let total = 0;
      let available = 0;
      const lineItems: MarketSummary['items'] = [];

      for (const pid of productIds) {
        const storePrice = priceMap.get(pid)?.get(store.id);
        const qty = qtyMap.get(pid) ?? 1;
        const prod = productMap.get(pid);
        if (!storePrice) continue;
        available++;
        const effectivePrice = storePrice.discount_price != null && storePrice.discount_price < storePrice.price
          ? storePrice.discount_price
          : storePrice.price;
        const subtotal = effectivePrice * qty;
        total += subtotal;
        lineItems.push({
          product_id: pid,
          name: prod ? `${prod.brand} ${prod.name}`.trim() : pid,
          price: storePrice.price,
          discount_price: storePrice.discount_price,
          qty,
          subtotal: Math.round(subtotal * 100) / 100,
        });
      }

      marketSummaries.push({
        market_id: store.id,
        market: store.name,
        total: Math.round(total * 100) / 100,
        available_products: available,
        missing_products: productIds.length - available,
        items: lineItems,
      });
    }

    // Sort by total (cheapest first, markets with missing items last)
    marketSummaries.sort((a, b) => {
      if (a.available_products !== b.available_products) return b.available_products - a.available_products;
      return a.total - b.total;
    });

    const best = marketSummaries[0];
    const worst = [...marketSummaries].sort((a, b) => b.total - a.total)[0];
    const saving = best && worst ? Math.round((worst.total - best.total) * 100) / 100 : 0;

    const resp: CompareResponse = {
      markets: marketSummaries,
      best_market: best?.market ?? '',
      best_market_id: best?.market_id ?? '',
      best_price: best?.total ?? 0,
      saving,
      total_products: productIds.length,
    };
    return NextResponse.json(resp);
  } catch (e) {
    return NextResponse.json({ error: errText(e) }, { status: 500 });
  }
}
