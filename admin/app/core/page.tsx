'use client';
import { useEffect, useMemo, useState } from 'react';
import { Store as StoreIcon } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { FindInStores } from '@/components/FindInStores';
import { Store, db } from '@/lib/supabase';

interface Row { id: string; brand: string; name: string; size: string; barcode: string | null; category: string; score: number; baskets: number; scans: number; adds: number; stores: string[] }

/**
 * The 300 products people reach for most, each with the stores that price
 * it. Sorted by demand, the thin ones first within a band: the gap that
 * matters is a popular product priced at one store.
 */
export default function Core() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [max, setMax] = useState(2);
  const [findId, setFindId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([fetch('/api/core').then(async (x) => { const j = await x.json(); if (!x.ok) throw new Error(j.error ?? `HTTP ${x.status}`); return j as { rows: Row[] }; }), db.select<Store>('stores', { order: 'name' })]);
      setRows(r.rows);
      setStores(s);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((r) => r.stores.length <= max), [rows, max]);
  const dist = useMemo(() => {
    const d = [0, 0, 0, 0];
    rows.forEach((r) => { d[Math.min(3, r.stores.length)]++; });
    return d;
  }, [rows]);

  return (
    <Shell title="Nüvə siyahısı">
      {err && <div className="alert err">{err}</div>}
      <p className="note" style={{ marginTop: 0 }}>Son 30 gündə ən çox skan olunan, səbətə düşən və izlənən 300 məhsul. Populyar məhsulun 1–2 marketdə qiyməti varsa, boşluq buradadır: "Marketlərdə tap" ilə doldur.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
        {(['0 market', '1 market', '2 market', '3+ market'] as const).map((label, i) => (
          <div key={label} className="card" style={{ padding: '10px 12px', cursor: 'pointer', border: max === i || (i === 3 && max >= 3) ? '2px solid #E53935' : '1px solid #ECECEE' }} onClick={() => setMax(i === 3 ? 99 : i)}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ['#B91C1C', '#C2410C', '#0F766E', '#15803D'][i] }}>{dist[i]}</div>
            <div className="muted" style={{ fontSize: 12 }}>{label}{rows.length ? ` · ${Math.round((dist[i] / rows.length) * 100)}%` : ''}</div>
          </div>
        ))}
      </div>
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 12 }}>Göstərilir: ≤ {max >= 3 ? '∞' : max} marketdə qiyməti olanlar · {visible.length} məhsul</span>
      </div>
      <table>
        <thead><tr><th>#</th><th>Məhsul</th><th>Tələb (30 gün)</th><th>Marketlər</th><th></th></tr></thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={r.id}>
              <td className="muted">{i + 1}</td>
              <td>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{`${r.brand} ${r.name}`.trim()}</div>
                <div className="muted" style={{ fontSize: 11 }}>{r.size}{r.barcode ? ` · ${r.barcode}` : ''} · {r.category}</div>
              </td>
              <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>səbətdə {r.baskets} · əlavə {r.adds} · skan {r.scans}</td>
              <td>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {stores.map((s) => {
                    const has = r.stores.includes(s.id);
                    return <span key={s.id} title={s.name} style={{ fontSize: 11, padding: '1px 7px', borderRadius: 999, background: has ? s.color : '#F1F1F3', color: has ? '#fff' : '#9CA3AF', fontWeight: 600 }}>{s.initial}</span>;
                  })}
                </div>
              </td>
              <td style={{ textAlign: 'right' }}><button className="btn secondary" style={{ fontSize: 12 }} onClick={() => setFindId(r.id)}><StoreIcon size={13} /> Marketlərdə tap</button></td>
            </tr>
          ))}
          {!loading && visible.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>{rows.length ? 'Bu süzgəcdə məhsul yoxdur.' : 'Hələ hadisə yoxdur: tətbiqdə skan və səbət hərəkəti olduqca siyahı dolacaq.'}</td></tr>}
          {loading && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>Yüklənir…</td></tr>}
        </tbody>
      </table>
      {findId && <FindInStores productId={findId} stores={stores} onClose={() => setFindId(null)} onLinked={load} />}
    </Shell>
  );
}
