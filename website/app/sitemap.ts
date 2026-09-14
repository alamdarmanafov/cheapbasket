import type { MetadataRoute } from 'next';
import { productIndex } from '@/lib/catalog';

export const dynamic = 'force-static';

const SITE = 'https://cheapmarket.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await productIndex();
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...products.map((p) => ({ url: `${SITE}/product/${p.id}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 })),
  ];
}
