'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

interface Counts { stores: number; products: number; prices: number; branches: number; users: number; plus: number; tokens: number }

export default function Dashboard() {
  const [c, setC] = useState<Counts | null>(null);
  useEffect(() => {
    (async () => {
      const count = (t: string, eq?: Record<string, unknown>) => db.count(t, eq).catch(() => 0);
      setC({
        stores: await count('stores'),
        products: await count('products'),
        prices: await count('prices'),
        branches: await count('branches'),
        users: await count('profiles'),
        plus: await count('profiles', { plan: 'plus' }),
        tokens: await count('push_tokens'),
      });
    })();
  }, []);

  return (
    <Shell title="Panel">
      <div className="grid cols-4">
        {[
          ['Marketlər', c?.stores, '/stores'],
          ['Məhsullar', c?.products, '/products'],
          ['Qiymət sətirləri', c?.prices, '/products'],
          ['Filiallar', c?.branches, '/branches'],
          ['İstifadəçilər', c?.users, '/users'],
          ['Plus abunəçi', c?.plus, '/users'],
          ['Push cihazları', c?.tokens, '/notifications'],
        ].map(([label, n, href]) => (
          <Link key={label as string} href={href as string} className="card stat">
            <b>{n ?? '…'}</b>
            <small>{label}</small>
          </Link>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Başlanğıc</h2>
        <ol className="muted" style={{ lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
          <li><Link href="/stores"><b>Marketlər</b></Link> — zəncirləri yoxla (Araz, Bravo…), lazım olsa əlavə et.</li>
          <li><Link href="/products"><b>Məhsullar</b></Link> — məhsul əlavə et, hər market üçün qiymət yaz. Boş qiymət = həmin marketdə yoxdur.</li>
          <li><Link href="/branches"><b>Filiallar</b></Link> — ad, ünvan, koordinat (Google Maps-dən). Xəritə və "ən yaxın filial" bundan gəlir.</li>
          <li><Link href="/users"><b>İstifadəçilər</b></Link> — Plus planını əl ilə aç/bağla.</li>
          <li><Link href="/notifications"><b>Bildirişlər</b></Link> — bütün cihazlara push göndər.</li>
        </ol>
      </div>
    </Shell>
  );
}
