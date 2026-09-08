'use client';
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/Shell';
import { db, Store, Product, PriceRow } from '@/lib/supabase';

interface WoltVenue { slug: string; name: string; address: string | null; url: string }

type PriceMap = Map<string, Map<string, { price: number | null; discount_price: number | null }>>;

function buildPriceMap(prices: PriceRow[]): PriceMap {
  const m: PriceMap = new Map();
  for (const p of prices) {
    if (!m.has(p.product_id)) m.set(p.product_id, new Map());
    m.get(p.product_id)!.set(p.store_id, { price: p.price, discount_price: p.discount_price });
  }
  return m;
}

function effectivePrice(entry: { price: number | null; discount_price: number | null } | undefined): number | null {
  if (!entry) return null;
  return entry.discount_price ?? entry.price;
}

function fmtPrice(v: number | null): string {
  if (v == null) return '—';
  return v.toFixed(2) + ' ₼';
}

function downloadCSV(products: Product[], stores: Store[], priceMap: PriceMap) {
  const header = ['Ad', 'Barkod', ...stores.map((s) => s.name)];
  const rows = products.map((p) => {
    const storeMap = priceMap.get(p.id);
    return [
      `"${p.name.replace(/"/g, '""')}"`,
      p.barcode ?? '',
      ...stores.map((s) => {
        const ep = effectivePrice(storeMap?.get(s.id));
        return ep != null ? ep.toFixed(2) : '';
      }),
    ];
  });
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'qiymətlər.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PricesPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [highlightStore, setHighlightStore] = useState('');
  const [missingFilterStore, setMissingFilterStore] = useState('');

  // Missing prices panel
  const [activeTab, setActiveTab] = useState<'table' | 'missing'>('table');

  // Wolt search modal
  const [woltProduct, setWoltProduct] = useState<Product | null>(null);
  const [woltResults, setWoltResults] = useState<WoltVenue[] | null>(null);
  const [woltLoading, setWoltLoading] = useState(false);
  const [woltErr, setWoltErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [storeRows, productRows, priceRows] = await Promise.all([
        db.select<Store>('stores', { order: 'name' }),
        db.select<Product>('products', { order: 'name', fetchAll: true }),
        db.select<PriceRow>('prices', { columns: 'product_id,store_id,price,discount_price', fetchAll: true }),
      ]);
      setStores(storeRows);
      setProducts(productRows);
      setPrices(priceRows);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const priceMap = useMemo(() => buildPriceMap(prices), [prices]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q) || (p.brand ?? '').toLowerCase().includes(q));
    }
    if (onlyMissing) {
      list = list.filter((p) => {
        const storeMap = priceMap.get(p.id);
        return stores.some((s) => !storeMap?.has(s.id));
      });
    }
    if (missingFilterStore) {
      list = list.filter((p) => !priceMap.get(p.id)?.has(missingFilterStore));
    }
    return list;
  }, [products, search, onlyMissing, missingFilterStore, stores, priceMap]);

  // Missing counts per store
  const missingPerStore = useMemo(() => {
    return stores.map((s) => ({
      store: s,
      count: products.filter((p) => !priceMap.get(p.id)?.has(s.id)).length,
    }));
  }, [stores, products, priceMap]);

  // Wolt search
  const searchWolt = async (p: Product) => {
    setWoltProduct(p);
    setWoltResults(null);
    setWoltErr(null);
    setWoltLoading(true);
    try {
      const r = await fetch(`/api/import/wolt/venues?q=${encodeURIComponent(p.name)}`);
      const j = await r.json() as { venues?: WoltVenue[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setWoltResults(j.venues ?? []);
    } catch (e) {
      setWoltErr((e as Error).message);
    } finally {
      setWoltLoading(false);
    }
  };

  return (
    <Shell title="Qiymət müqayisə cədvəli">
      {err && <div className="alert err">{err}</div>}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'table' ? '' : 'secondary'}`} onClick={() => setActiveTab('table')}>Qiymət cədvəli</button>
        <button className={`btn ${activeTab === 'missing' ? '' : 'secondary'}`} onClick={() => setActiveTab('missing')}>Çatışmayan qiymətlər</button>
        <div style={{ flex: 1 }} />
        <button className="btn secondary" onClick={load} disabled={loading}>Yenilə</button>
        <button className="btn secondary" onClick={() => downloadCSV(filteredProducts, stores, priceMap)} disabled={loading || products.length === 0}>CSV ixrac</button>
      </div>

      {/* ═══════════════════════ PRICE TABLE TAB ═══════════════════════ */}
      {activeTab === 'table' && (
        <>
          <div className="toolbar">
            <input
              placeholder="Məhsul adı və ya barkod ilə axtar…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 260 }}
            />
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6, fontSize: 13, color: '#171717', fontWeight: 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={onlyMissing} onChange={(e) => { setOnlyMissing(e.target.checked); setMissingFilterStore(''); }} style={{ width: 'auto', padding: 0 }} />
              Yalnız qiymətsiz
            </label>
            <select value={highlightStore} onChange={(e) => setHighlightStore(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">— Ən ucuzu vurgulama —</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {missingFilterStore && (
              <span className="pill red" style={{ cursor: 'pointer' }} onClick={() => setMissingFilterStore('')}>
                ✕ {stores.find((s) => s.id === missingFilterStore)?.name ?? missingFilterStore}
              </span>
            )}
            <span className="muted" style={{ fontSize: 13 }}>{filteredProducts.length} məhsul</span>
          </div>

          {loading ? (
            <p className="muted">Yüklənir…</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Məhsul</th>
                    <th style={{ minWidth: 110 }}>Barkod</th>
                    {stores.map((s) => (
                      <th key={s.id} style={{ minWidth: 100, textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                          {s.name}
                        </span>
                      </th>
                    ))}
                    <th style={{ minWidth: 80 }}>Wolt</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice(0, 500).map((p) => {
                    const storeMap = priceMap.get(p.id);
                    // Find cheapest store price
                    let cheapestStoreId: string | null = null;
                    let cheapestPrice = Infinity;
                    for (const s of stores) {
                      const ep = effectivePrice(storeMap?.get(s.id));
                      if (ep != null && ep < cheapestPrice) { cheapestPrice = ep; cheapestStoreId = s.id; }
                    }
                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                          {p.brand && <div className="muted" style={{ fontSize: 11 }}>{p.brand}{p.size ? ` · ${p.size}` : ''}</div>}
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>{p.barcode ?? '—'}</td>
                        {stores.map((s) => {
                          const entry = storeMap?.get(s.id);
                          const ep = effectivePrice(entry);
                          const isCheapest = cheapestStoreId === s.id && stores.length > 1;
                          const isHighlighted = highlightStore === s.id && isCheapest;
                          const isMissing = !storeMap?.has(s.id);
                          return (
                            <td key={s.id} style={{ textAlign: 'right', fontSize: 13, background: isHighlighted ? '#E8F7EE' : isMissing ? '#FFF8F8' : undefined }}>
                              {isMissing ? (
                                <span className="muted">—</span>
                              ) : (
                                <span>
                                  {entry?.discount_price != null ? (
                                    <>
                                      <span style={{ color: '#E53935', fontWeight: 700 }}>{fmtPrice(entry.discount_price)}</span>
                                      {' '}
                                      <span className="muted" style={{ textDecoration: 'line-through', fontSize: 11 }}>{fmtPrice(entry.price)}</span>
                                    </>
                                  ) : (
                                    fmtPrice(ep)
                                  )}
                                  {isCheapest && <span className="pill green" style={{ marginLeft: 4, fontSize: 10 }}>↓</span>}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <button className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => searchWolt(p)}>Wolt-da tap</button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length > 500 && (
                    <tr><td colSpan={stores.length + 3} className="muted" style={{ textAlign: 'center', padding: 12 }}>Göstərilən: 500 / {filteredProducts.length} — axtarış ilə daralt</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ MISSING PRICES TAB ═══════════════════════ */}
      {activeTab === 'missing' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
            {missingPerStore.map(({ store: s, count }) => (
              <div
                key={s.id}
                className="card"
                style={{ cursor: 'pointer', border: missingFilterStore === s.id ? `2px solid ${s.color}` : '1px solid #ECECEE' }}
                onClick={() => { setMissingFilterStore(missingFilterStore === s.id ? '' : s.id); setActiveTab('table'); }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%', background: s.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>{s.initial}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{count} məhsulun qiyməti yoxdur</div>
                  </div>
                </div>
                {count > 0 && (
                  <button className="btn secondary" style={{ marginTop: 10, width: '100%', fontSize: 12, justifyContent: 'center' }}
                    onClick={(e) => { e.stopPropagation(); setMissingFilterStore(s.id); setActiveTab('table'); }}>
                    Cədvəldə göstər →
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Missing products list per store (first missing store or selected) */}
          {missingPerStore.map(({ store: s, count }) => {
            if (count === 0) return null;
            const missingList = products.filter((p) => !priceMap.get(p.id)?.has(s.id));
            return (
              <div key={s.id} className="card" style={{ marginBottom: 16 }}>
                <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: s.color, color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{s.initial}</span>
                  {s.name} — {count} qiymətsiz məhsul
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 220 }}>Məhsul</th>
                        <th style={{ minWidth: 110 }}>Barkod</th>
                        <th>Wolt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingList.slice(0, 100).map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            {p.brand && <div className="muted" style={{ fontSize: 11 }}>{p.brand}{p.size ? ` · ${p.size}` : ''}</div>}
                          </td>
                          <td className="muted" style={{ fontSize: 12 }}>{p.barcode ?? '—'}</td>
                          <td>
                            <button className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => searchWolt(p)}>Wolt-da tap</button>
                          </td>
                        </tr>
                      ))}
                      {missingList.length > 100 && (
                        <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 12 }}>Göstərilən: 100 / {missingList.length}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ═══════════════════════ WOLT MODAL ═══════════════════════ */}
      {woltProduct && (
        <div className="modal-bg" onClick={() => setWoltProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Wolt axtarışı · {woltProduct.name}</h2>
            {woltLoading && <p className="muted">Axtarılır…</p>}
            {woltErr && <div className="alert err">{woltErr}</div>}
            {woltResults && woltResults.length === 0 && <p className="muted">Nəticə tapılmadı</p>}
            {woltResults && woltResults.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {woltResults.map((v) => (
                  <div key={v.slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F7F7F7', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                      {v.address && <div className="muted" style={{ fontSize: 12 }}>{v.address}</div>}
                    </div>
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Wolt-da aç ↗</a>
                  </div>
                ))}
              </div>
            )}
            <div className="actions">
              <button className="btn secondary" onClick={() => setWoltProduct(null)}>Bağla</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
