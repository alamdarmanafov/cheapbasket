'use client';
import { useEffect, useState, useMemo } from 'react';
import { Shell } from '@/components/Shell';
import { db, Store, Product, PriceRow } from '@/lib/supabase';

const PAGE_SIZE = 50;

export default function ComparePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, p, pr] = await Promise.all([
        db.select<Store>('stores', { order: 'name' }),
        db.select<Product>('products', { columns: 'id,name,brand,size', order: 'name' }),
        db.select<PriceRow>('prices', { columns: 'product_id,store_id,price,discount_price' }),
      ]);
      setStores(s);
      setProducts(p);
      setPrices(pr);
      setLoading(false);
    })();
  }, []);

  // Build price lookup: product_id → store_id → { price, discount }
  const priceMap = useMemo(() => {
    const m = new Map<string, Map<string, { price: number; discount: number | null }>>();
    for (const r of prices) {
      if (!m.has(r.product_id)) m.set(r.product_id, new Map());
      m.get(r.product_id)!.set(r.store_id, { price: Number(r.price ?? 0), discount: r.discount_price != null ? Number(r.discount_price) : null });
    }
    return m;
  }, [prices]);

  const eff = (p: { price: number; discount: number | null }) => p.discount ?? p.price;

  const filtered = useMemo(() => {
    if (!q.trim()) return products;
    const lq = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(lq) || (p.brand ?? '').toLowerCase().includes(lq));
  }, [products, q]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Cheapest store per product on current page
  const cheapestStore = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of paged) {
      const storeMap = priceMap.get(p.id);
      if (!storeMap) continue;
      let best: { storeId: string; val: number } | null = null;
      for (const [sid, pr] of storeMap) {
        const v = eff(pr);
        if (!best || v < best.val) best = { storeId: sid, val: v };
      }
      if (best) m.set(p.id, best.storeId);
    }
    return m;
  }, [paged, priceMap]);

  const fmt = (v: number) => v.toFixed(2) + ' ₼';

  return (
    <Shell title="Qiymət müqayisəsi">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Məhsul axtar…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          style={{ flex: 1, minWidth: 200 }}
        />
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} məhsul · {stores.length} mağaza</span>
      </div>

      {loading ? (
        <p className="muted">Yüklənir…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Məhsul</th>
                  {stores.map((s) => (
                    <th key={s.id} style={{ textAlign: 'center', minWidth: 90 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 4, verticalAlign: 'middle' }} />
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((p) => {
                  const storeMap = priceMap.get(p.id);
                  const cheapSid = cheapestStore.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                        {p.brand && <div className="muted" style={{ fontSize: 11 }}>{p.brand}{p.size ? ' · ' + p.size : ''}</div>}
                      </td>
                      {stores.map((s) => {
                        const pr = storeMap?.get(s.id);
                        const isCheap = cheapSid === s.id;
                        if (!pr) return <td key={s.id} style={{ textAlign: 'center', color: '#ccc', fontSize: 12 }}>—</td>;
                        const hasDiscount = pr.discount != null && pr.discount < pr.price;
                        return (
                          <td key={s.id} style={{ textAlign: 'center', background: isCheap ? '#e8f5e9' : undefined, fontWeight: isCheap ? 700 : undefined }}>
                            {hasDiscount ? (
                              <>
                                <span style={{ color: '#E53935', fontWeight: 700, fontSize: 13 }}>{fmt(pr.discount!)}</span>
                                <br />
                                <span className="muted" style={{ fontSize: 11, textDecoration: 'line-through' }}>{fmt(pr.price)}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: 13 }}>{fmt(pr.price)}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paged.length === 0 && (
                  <tr><td colSpan={stores.length + 1} style={{ textAlign: 'center', color: '#999', padding: 24 }}>Məhsul tapılmadı</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn secondary" disabled={page === 0} onClick={() => setPage(0)}>«</button>
              <button className="btn secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
              <span className="muted" style={{ fontSize: 13 }}>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
              <button className="btn secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
              <button className="btn secondary" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
