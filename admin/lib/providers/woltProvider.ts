/**
 * Wolt-based market provider.
 * Most Azerbaijani supermarkets (Araz, Bazarstore, Bravo, Neptun, OBA, SPAR, Tam Store)
 * have their online store on Wolt. This provider uses the existing Wolt fetch infrastructure.
 */
import { fetchAnySource, splitName } from '../wolt';
import type { MarketProduct, MarketProvider, ProviderResult } from './types';

function parseSize(size: string): { quantity: string; unit: string } {
  const m = size.match(/^(\d+(?:[.,]\d+)?)\s?(.+)$/);
  if (m) return { quantity: m[1].replace(',', '.'), unit: m[2].trim() };
  return { quantity: '1', unit: size || 'ədəd' };
}

export function createWoltProvider(config: { market: string; name: string; woltUrl: string }): MarketProvider {
  return {
    market: config.market,
    name: config.name,
    async fetch(): Promise<ProviderResult> {
      const at = new Date().toISOString();
      try {
        const result = await fetchAnySource(config.woltUrl);
        const products: MarketProduct[] = result.items
          .filter((it) => it.price != null)
          .map((it) => {
            const sp = splitName(it.name);
            const { quantity, unit } = parseSize(sp.size || '1 ədəd');
            const price = it.regular_price != null ? it.regular_price : (it.price ?? 0);
            const discountPrice = it.regular_price != null ? it.price : null;
            return {
              external_id: it.ext_id,
              name: it.name,
              brand: sp.brand || config.name,
              category: it.category,
              barcode: it.barcode,
              quantity,
              unit,
              price: price ?? 0,
              old_price: discountPrice != null && discountPrice < (price ?? 0) ? price : null,
              discount: discountPrice != null,
              image_url: it.image_url,
              product_url: null,
              market: config.market,
              last_updated: at,
            };
          });
        return { market: config.market, products };
      } catch (e) {
        return { market: config.market, products: [], error: (e as Error).message };
      }
    },
  };
}
