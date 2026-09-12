'use client';
import { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/Shell';
import { Pager, usePager } from '@/components/Pager';
import { FindInStores } from '@/components/FindInStores';
import { db, Store, Product, PriceRow } from '@/lib/supabase';


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

  // "Marketlərdə tap" modal

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

  const { page, setPage, totalPages, paged } = usePager(filteredProducts);

  // Missing counts per store
  const missingPerStore = useMemo(() => {
    return stores.map((s) => ({
      store: s,
      count: products.filter((p) => !priceMap.get(p.id)?.has(s.id)).length,
    }));
  }, [stores, products, priceMap]);

  // How many stores each product is priced at. A product priced at one store
  // cannot be compared, which is the whole point of the app.
  const coverage = useMemo(() => {
    const buckets = { none: [] as Product[], one: [] as Product[], two: [] as Product[], more: [] as Product[] };
    for (const p of products) {
      const n = priceMap.get(p.id)?.size ?? 0;
      (n === 0 ? buckets.none : n === 1 ? buckets.one : n === 2 ? buckets.two : buckets.more).push(p);
    }
    return buckets;
  }, [products, priceMap]);

  /** Download a list as CSV: what to check on the next walk through a store. */
  const exportCsv = (rows: Product[], filename: string, storeName?: string) => {
    const esc = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Barkod', 'Brend', 'Ad', 'Ölçü', 'Kateqoriya', 'Qiymətli marketlər', ...(storeName ? [`${storeName} qiyməti`] : [])];
    const body = rows.map((p) => {
      const have = [...(priceMap.get(p.id)?.keys() ?? [])].map((id) => stores.find((s) => s.id === id)?.name ?? id).join(' / ');
      return [p.barcode, p.brand, p.name, p.size, p.category, have, ...(storeName ? [''] : [])].map(esc).join(';');
    });
    const blob = new Blob(['\ufeff' + [head.map(esc).join(';'), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Run the store's sync sources now: every product whose barcode the feed
  // carries gets this store's price. The answer says how much the barcode did.
  const [filling, setFilling] = useState<string | null>(null);
  const fillFromSources = async (s: Store) => {
    setFilling(s.id);
    setErr(null);
    try {
      const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'run', store_id: s.id }) });
      const j = (await r.json()) as { results?: Array<{ ok: boolean; found: number; matched: number; byBarcode?: number; updated: number; pending: number; error?: string }>; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const rs = j.results ?? [];
      if (!rs.length) throw new Error(`${s.name} üçün aktiv mənbə yoxdur. "Sinxronizasiya" səhifəsində Wolt filialını və ya saytı əlavə et.`);
      const sum = rs.reduce((a, x) => ({ found: a.found + x.found, matched: a.matched + x.matched, byBarcode: a.byBarcode + (x.byBarcode ?? 0), updated: a.updated + x.updated }), { found: 0, matched: 0, byBarcode: 0, updated: 0 });
      const failed = rs.filter((x) => !x.ok).map((x) => x.error).filter(Boolean);
      setFillMsg(`${s.name}: ${rs.length} mənbə · ${sum.found} məhsul tapıldı · ${sum.matched} bizimkilərlə uyğun (${sum.byBarcode} barkodla) · ${sum.updated} qiymət yazıldı${failed.length ? ` · xəta: ${failed.join(' | ')}` : ''}`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setFilling(null);
    }
  };
  const [fillMsg, setFillMsg] = useState<string | null>(null);

  const [findId, setFindId] = useState<string | null>(null);

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
                    <th style={{ minWidth: 80 }}>Tap</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => {
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
                          <button className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setFindId(p.id)}>Marketlərdə tap</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pager page={page} setPage={setPage} totalPages={totalPages} total={filteredProducts.length} unit="məhsul" />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ MISSING PRICES TAB ═══════════════════════ */}
      {activeTab === 'missing' && (
        <>
          {fillMsg && <div className="alert ok" style={{ marginBottom: 12 }}>{fillMsg}</div>}
          {/* Coverage: the number that decides whether a comparison is possible at all. */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Əhatə: neçə marketdə qiyməti var</div>
                <div className="muted" style={{ fontSize: 12 }}>Müqayisə üçün ən azı 2 market lazımdır. CSV-ni götürüb mağazada yoxlamaq, ya da "Çeklər" səhifəsindəki qiymət təkliflərini tətbiq etmək boşluğu bağlayır.</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => exportCsv([...coverage.none, ...coverage.one], 'tek-marketli-mehsullar.csv')}>CSV: 0–1 marketli ({coverage.none.length + coverage.one.length})</button>
                <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => exportCsv(products, 'butun-mehsullar-ehate.csv')}>CSV: hamısı</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
              {([['0 market', coverage.none.length, '#B91C1C'], ['1 market', coverage.one.length, '#C2410C'], ['2 market', coverage.two.length, '#0F766E'], ['3+ market', coverage.more.length, '#15803D']] as const).map(([label, n, color]) => (
                <div key={label} style={{ background: '#FAFAFA', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{n}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{label}{products.length ? ` · ${Math.round((n / products.length) * 100)}%` : ''}</div>
                </div>
              ))}
            </div>
          </div>

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
                  <>
                    <button className="btn" style={{ marginTop: 10, width: '100%', fontSize: 12, justifyContent: 'center' }} disabled={!!filling}
                      title="Bu marketin mənbələrini (Wolt filialı / sayt) indi çək; barkodu uyğun gələn hər məhsula qiymət yazılır"
                      onClick={(e) => { e.stopPropagation(); fillFromSources(s); }}>
                      {filling === s.id ? 'Çəkilir…' : 'Barkodla doldur'}
                    </button>
                    <button className="btn secondary" style={{ marginTop: 6, width: '100%', fontSize: 12, justifyContent: 'center' }}
                      onClick={(e) => { e.stopPropagation(); setMissingFilterStore(s.id); setActiveTab('table'); }}>
                      Cədvəldə göstər →
                    </button>
                  </>
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
                <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn secondary" style={{ fontSize: 12, marginLeft: 'auto', order: 9 }} onClick={() => exportCsv(missingList, `${s.id}-catismayan.csv`, s.name)}>CSV ({count})</button>
                  <span style={{ background: s.color, color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{s.initial}</span>
                  {s.name} — {count} qiymətsiz məhsul
                </h2>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 220 }}>Məhsul</th>
                        <th style={{ minWidth: 110 }}>Barkod</th>
                        <th>Tap</th>
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
                            <button className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => setFindId(p.id)}>Marketlərdə tap</button>
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

      {findId && <FindInStores productId={findId} stores={stores} onClose={() => setFindId(null)} onLinked={load} />}
    </Shell>
  );
}
