import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductPage } from '@/components/ProductPage';
import { fullName, productIndex } from '@/lib/catalog';

export const dynamicParams = false;

/** One static page per product: the name is in the HTML for search engines; the prices load in the browser. */
export async function generateStaticParams() {
  const rows = await productIndex();
  // A static export refuses an empty list (a build without the Supabase
  // variables, say); one placeholder keeps the route and renders "not found".
  return rows.length ? rows.map((p) => ({ id: p.id })) : [{ id: '_' }];
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = (await productIndex()).find((x) => x.id === params.id);
  if (!p) return { title: 'Məhsul — Cheap Market AI' };
  const name = fullName(p);
  const title = `${name} qiyməti — marketlərdə müqayisə | Cheap Market AI`;
  const description = `${name}: Bakı marketlərində (Araz, Bravo, OBA, Neptun və başqaları) bugünkü qiymətlər, ən ucuz market və ən yaxın filial. Kateqoriya: ${p.category}.`;
  return {
    title,
    description,
    alternates: { canonical: `/product/${p.id}` },
    openGraph: { title, description, type: 'website', url: `/product/${p.id}` },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const p = (await productIndex()).find((x) => x.id === params.id);
  if (!p) {
    if (params.id === '_')
      return (
        <Suspense fallback={null}>
          <ProductPage id="_" />
        </Suspense>
      );
    notFound();
  }
  return (
    <Suspense fallback={null}>
      {/* The static part search engines read; the client fills in the prices under it. */}
      <ProductPage id={p.id} seed={{ name: p.name, brand: p.brand, size: p.size, category: p.category }} />
    </Suspense>
  );
}
