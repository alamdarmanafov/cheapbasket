'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { StoreBadges } from '@/components/StoreBadges';
import { useLang } from '@/components/LangContext';
import { LINKS } from '@/components/content';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface Row { id: string; name: string; brand: string; size: string; image_url: string | null; prices: Record<string, number | null> | null }
interface Store { id: string; name: string; color: string | null; logo_url: string | null }

const COPY = {
  az: { cheapest: 'Ən ucuz', open: 'Tətbiqdə aç', notFound: 'Məhsul tapılmadı', loading: 'Yüklənir…', get: 'Bütün qiymətləri müqayisə etmək üçün tətbiqi yüklə' },
  en: { cheapest: 'Cheapest', open: 'Open in the app', notFound: 'Product not found', loading: 'Loading…', get: 'Get the app to compare every price' },
  tr: { cheapest: 'En ucuz', open: 'Uygulamada aç', notFound: 'Ürün bulunamadı', loading: 'Yükleniyor…', get: 'Tüm fiyatları karşılaştırmak için uygulamayı indir' },
  ru: { cheapest: 'Дешевле всего', open: 'Открыть в приложении', notFound: 'Товар не найден', loading: 'Загрузка…', get: 'Скачайте приложение, чтобы сравнить все цены' },
} as const;

/**
 * The page a shared product link lands on. Reads straight from the public
 * view with the anon key — the same data the app shows — and offers the deep
 * link, which the app answers when installed.
 */
export function ProductPage() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const { lang } = useLang();
  const c = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : 'az'];
  const [row, setRow] = useState<Row | null | undefined>(undefined);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    if (!id || !SUPABASE_URL || !SUPABASE_KEY) { setRow(null); return; }
    const h = { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/product_prices?id=eq.${encodeURIComponent(id)}&select=id,name,brand,size,image_url,prices`, { headers: h }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/stores?select=id,name,color,logo_url`, { headers: h }).then((r) => r.json()),
    ])
      .then(([p, s]) => { setRow(Array.isArray(p) && p[0] ? (p[0] as Row) : null); setStores(Array.isArray(s) ? (s as Store[]) : []); })
      .catch(() => setRow(null));
  }, [id]);

  const priced = row
    ? Object.entries(row.prices ?? {})
        .filter((e): e is [string, number] => e[1] != null)
        .map(([sid, price]) => ({ store: stores.find((s) => s.id === sid) ?? { id: sid, name: sid, color: null, logo_url: null }, price: Number(price) }))
        .sort((a, b) => a.price - b.price)
    : [];
  const deepLink = `cheapbasket://product/${encodeURIComponent(id)}`;

  return (
    <main>
      <header className="nav"><div className="container nav-inner"><Logo /></div></header>
      <section className="container" style={{ maxWidth: 560, padding: '32px 20px 64px' }}>
        {row === undefined ? (
          <p className="muted">{c.loading}</p>
        ) : row === null ? (
          <h1 style={{ fontSize: 24 }}>{c.notFound}</h1>
        ) : (
          <>
            {row.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.image_url} alt="" style={{ width: 160, height: 160, objectFit: 'contain', borderRadius: 16, background: '#fff', display: 'block', margin: '0 auto 16px' }} />
            )}
            <p className="muted" style={{ margin: 0 }}>{row.brand}</p>
            <h1 style={{ fontSize: 28, margin: '4px 0 4px' }}>{row.name}</h1>
            <p className="muted" style={{ marginTop: 0 }}>{row.size}</p>
            {priced.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginTop: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                {priced.map((p, i) => (
                  <div key={p.store.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: i ? '1px solid #eee' : 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 14, background: p.store.color ?? '#6B7280', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>{p.store.name.slice(0, 1)}</span>
                      <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{p.store.name}</span>
                      {i === 0 && <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 700 }}>{c.cheapest}</span>}
                    </span>
                    <strong style={{ color: i === 0 ? '#E53935' : '#111' }}>{p.price.toFixed(2)} ₼</strong>
                  </div>
                ))}
              </div>
            )}
            <a className="download" href={deepLink} style={{ display: 'block', textAlign: 'center', marginTop: 24 }}>{c.open}</a>
            <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>{c.get}</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}><StoreBadges appStore={LINKS.appStore} googlePlay={LINKS.googlePlay} /></div>
          </>
        )}
      </section>
    </main>
  );
}
