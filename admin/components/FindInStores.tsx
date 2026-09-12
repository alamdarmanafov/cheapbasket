'use client';
import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';

interface Candidate { ext_id: string; name: string; price: number; regular_price: number | null; barcode: string | null; image_url: string | null; score: number; exactBarcode: boolean }
interface StoreResult { store_id: string; store_name: string; have: number | null; sources: number; candidates: Candidate[]; linked: string | null; error?: string }
interface Found { product: { id: string; brand: string; name: string; size: string; barcode: string | null }; results: StoreResult[] }

/**
 * One product against every store's feed. Each store shows its closest items
 * with the price; "Bu odur" writes the price and remembers the link, so the
 * nightly sync recognises the item from then on.
 */
export function FindInStores({ productId, storeColors, onClose, onLinked }: { productId: string; storeColors: Record<string, string>; onClose: () => void; onLinked?: () => void }) {
  const [data, setData] = useState<Found | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({}); // store_id → ext_id just linked

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    fetch('/api/products/find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId }) })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`); return j as Found; })
      .then((j) => { if (alive) setData(j); })
      .catch((e: Error) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [productId]);

  const link = async (s: StoreResult, c: Candidate) => {
    setBusy(`${s.store_id}:${c.ext_id}`);
    try {
      const r = await fetch('/api/products/find', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, store_id: s.store_id, ext_id: c.ext_id, price: c.price, regular_price: c.regular_price, barcode: c.barcode }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDone((d) => ({ ...d, [s.store_id]: c.ext_id }));
      onLinked?.();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const p = data?.product;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(820px,100%)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Marketlərdə tap{p ? <span className="muted" style={{ fontWeight: 500 }}> · {p.brand} {p.name} {p.size}</span> : null}</h2>
          <button className="btn ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Hər marketin mənbəyində (Wolt filialı / sayt) bu məhsula ən oxşar sətirlər. "Bu odur" qiyməti yazır və linki yadda saxlayır: sinxron bundan sonra o sətri həmişə bu məhsul kimi tanıyır.</p>
        {err && <div className="alert err">{err}</div>}
        {!data && !err && <p className="muted" style={{ padding: 20, textAlign: 'center' }}>Mənbələr çəkilir… (ilk dəfə 10–30 saniyə, sonra keşdən)</p>}
        {data && (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {data.results.map((s) => {
              const linkedNow = done[s.store_id] ?? s.linked;
              return (
                <div key={s.store_id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 999, background: storeColors[s.store_id] ?? '#999', color: '#fff', fontWeight: 700, fontSize: 12 }}>{s.store_name}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {s.have != null ? <>bizdə: <b>{s.have.toFixed(2)} ₼</b></> : 'bizdə qiymət yoxdur'}
                      {s.sources === 0 && ' · mənbə yoxdur'}
                      {linkedNow && <> · <Link2 size={11} style={{ verticalAlign: -1 }} /> link var</>}
                    </span>
                    {s.error && <span className="pill red" style={{ fontSize: 11 }}>{s.error}</span>}
                  </div>
                  {s.sources > 0 && s.candidates.length === 0 && !s.error && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Oxşar sətir tapılmadı. Bu market ehtimal ki satmır, ya da ad çox fərqlidir.</div>}
                  {s.candidates.map((c) => {
                    const isLinked = linkedNow === c.ext_id;
                    return (
                      <div key={c.ext_id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '6px 8px', background: isLinked ? '#F0FDF4' : '#FAFAFA', borderRadius: 8 }}>
                        {c.image_url ? <img src={c.image_url} alt="" width={32} height={32} style={{ borderRadius: 6, objectFit: 'cover' }} /> : <span style={{ width: 32 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {c.exactBarcode ? <b style={{ color: '#15803D' }}>barkod eynidir</b> : `oxşarlıq ${Math.round(c.score * 100)}%`}
                            {c.barcode ? ` · ${c.barcode}` : ''}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {c.price.toFixed(2)} ₼
                          {c.regular_price != null && <span className="muted" style={{ fontWeight: 400, textDecoration: 'line-through', marginLeft: 6 }}>{c.regular_price.toFixed(2)}</span>}
                        </div>
                        <button className={`btn ${isLinked ? 'secondary' : ''}`} style={{ fontSize: 12, whiteSpace: 'nowrap' }} disabled={!!busy} onClick={() => link(s, c)}>
                          {busy === `${s.store_id}:${c.ext_id}` ? '…' : isLinked ? 'Yenilə' : 'Bu odur'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        <div className="actions"><button className="btn secondary" onClick={onClose}>Bağla</button></div>
      </div>
    </div>
  );
}
