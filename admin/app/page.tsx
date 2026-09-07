'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

interface Counts { stores: number; products: number; prices: number; branches: number; users: number; plus: number; tokens: number }

export default function Dashboard() {
  const [c, setC] = useState<Counts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    setErr(null);
    // Parallel counts with a hard timeout so the dashboard never sits on "…".
    const count = (t: string, eq?: Record<string, unknown>) =>
      Promise.race([db.count(t, eq), new Promise<number>((_, rej) => setTimeout(() => rej(new Error(`${t}: 10 s ərzində cavab gəlmədi`)), 10000))]).catch((e: Error) => {
        setErr(e.message);
        return -1;
      });
    const [stores, products, prices, branches, users, plus, tokens] = await Promise.all([
      count('stores'), count('products'), count('prices'), count('branches'), count('profiles'), count('profiles', { plan: 'plus' }), count('push_tokens'),
    ]);
    setC({ stores, products, prices, branches, users, plus, tokens });
  };
  useEffect(() => { load(); }, []);

  return (
    <Shell title="Panel">
      {err && <div className="alert err">Baza ilə əlaqə xətası: {err} — Vercel-də SUPABASE_SERVICE_ROLE_KEY və NEXT_PUBLIC_SUPABASE_URL dəyişənlərini yoxla və Redeploy et.</div>}
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
            <b>{n == null ? '…' : n < 0 ? '?' : n}</b>
            <small>{label}</small>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><button className="btn secondary" onClick={load}>Yenilə</button></div>
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
