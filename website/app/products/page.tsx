import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { fullName, productIndex } from '@/lib/catalog';

export const metadata: Metadata = {
  title: 'Məhsullar və qiymətlər — Bakı marketləri | Cheap Market AI',
  description: 'Süd, yumurta, çörək, yağ və yüzlərlə məhsulun Araz, Bravo, OBA və digər marketlərdəki qiymətləri. Ən ucuz marketi tap.',
  alternates: { canonical: '/products' },
};

/** The catalogue as a page of links, grouped by category: what a search engine crawls to reach every product. */
export default async function Products() {
  const rows = await productIndex();
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.category || 'Digər', [...(groups.get(r.category || 'Digər') ?? []), r]);
  const cats = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'az'));
  return (
    <main>
      <header className="nav"><div className="container nav-inner"><Logo /></div></header>
      <section className="container" style={{ maxWidth: 960, padding: '32px 20px 64px' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 6px' }}>Məhsullar və qiymətlər</h1>
        <p className="muted" style={{ marginTop: 0 }}>{rows.length} məhsul · Bakı marketlərində bugünkü qiymətlər. Hər məhsulun səhifəsində ən ucuz market və filiallar.</p>
        {cats.length === 0 && <p className="muted">Siyahı hazırlanır.</p>}
        <nav aria-label="Kateqoriyalar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0 24px' }}>
          {cats.map((c) => (
            <a key={c} href={`#${encodeURIComponent(c)}`} style={{ fontSize: 13, padding: '6px 12px', borderRadius: 999, background: '#F1F1F3' }}>{c} <span className="muted">({groups.get(c)?.length ?? 0})</span></a>
          ))}
        </nav>
        {cats.map((c) => (
          <section key={c} id={encodeURIComponent(c)} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 20, margin: '0 0 10px' }}>{c}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '6px 16px' }}>
              {groups.get(c)!.map((p) => (
                <li key={p.id} style={{ fontSize: 14 }}>
                  <Link href={`/product/${p.id}`}>{fullName(p)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}
