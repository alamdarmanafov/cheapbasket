'use client';
import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';

interface Candidate { ext_id: string; name: string; price: number; regular_price: number | null; barcode: string | null; image_url: string | null; score: number; exactBarcode: boolean; web?: boolean }
interface StoreResult { store_id: string; store_name: string; have: number | null; sources: number; candidates: Candidate[]; linked: string | null; error?: string }
interface ProductInfo { id: string; brand: string; name: string; size: string; barcode: string | null }

/** A reply that is not JSON is the platform's own error page: say so in words. */
async function readJson<T>(r: Response): Promise<T> {
  const text = await r.text();
  try {
    const j = JSON.parse(text) as T & { error?: string };
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`Server cavab vermədi (HTTP ${r.status}): ${text.slice(0, 80)}`);
    throw e;
  }
}

/**
 * One product against every store's feed. Each store shows its closest items
 * with the price; "Bu odur" writes the price and remembers the link, so the
 * nightly sync recognises the item from then on.
 *
 * Stores are asked one at a time: a feed is a large download, and one request
 * for all of them exceeded what a serverless function may take.
 */
export function FindInStores({ productId, stores, onClose, onLinked }: { productId: string; stores: Array<{ id: string; name: string; color: string }>; onClose: () => void; onLinked?: () => void }) {
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [results, setResults] = useState<StoreResult[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({}); // store_id → ext_id just linked

  useEffect(() => {
    let alive = true;
    setProduct(null); setResults([]); setErr(null);
    (async () => {
      for (const s of stores) {
        if (!alive) return;
        setPending(s.id);
        try {
          const r = await fetch('/api/products/find', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, store_id: s.id }) });
          const j = await readJson<{ product: ProductInfo; result: StoreResult }>(r);
          if (!alive) return;
          setProduct((p) => p ?? j.product);
          setResults((rs) => [...rs, j.result]);
        } catch (e) {
          if (!alive) return;
          setResults((rs) => [...rs, { store_id: s.id, store_name: s.name, have: null, sources: 0, candidates: [], linked: null, error: (e as Error).message }]);
        }
      }
      if (alive) setPending(null);
    })();
    return () => { alive = false; };
    // The parent reloads its store list after a link; the same ids are the same job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, stores.map((s) => s.id).join(',')]);

  const link = async (s: StoreResult, c: Candidate) => {
    setBusy(`${s.store_id}:${c.ext_id}`);
    try {
      const r = await fetch('/api/products/find', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, store_id: s.store_id, ext_id: c.ext_id, price: c.price, regular_price: c.regular_price, barcode: c.barcode }) });
      await readJson<{ ok: true }>(r);
      setDone((d) => ({ ...d, [s.store_id]: c.ext_id }));
      onLinked?.();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(null); }
  };

  const p = product;
  const storeColors = Object.fromEntries(stores.map((s) => [s.id, s.color]));
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ width: 'min(820px,100%)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Marketlərdə tap{p ? <span className="muted" style={{ fontWeight: 500 }}> · {p.brand} {p.name} {p.size}</span> : null}</h2>
          <button className="btn ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Hər marketin mənbəyində (Wolt filialı, ya "Marketlər"də yazılmış sayt axtarışı) bu məhsula ən oxşar sətirlər. "Bu odur" qiyməti yazır; Wolt sətri üçün linki də saxlayır, sinxron bundan sonra onu həmişə bu məhsul kimi tanıyır.</p>
        {err && <div className="alert err">{err}</div>}
        {(results.length > 0 || pending) && (
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {results.map((s) => {
              const linkedNow = done[s.store_id] ?? s.linked;
              return (
                <div key={s.store_id} className="card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 999, background: storeColors[s.store_id] ?? '#999', color: '#fff', fontWeight: 700, fontSize: 12 }}>{s.store_name}</span>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {s.have != null ? <>bizdə: <b>{s.have.toFixed(2)} ₼</b></> : 'bizdə qiymət yoxdur'}
                      {s.sources === 0 && ' · mənbə yoxdur (Sinxronizasiya-da Wolt filialı və ya Marketlər-də sayt axtarışı yaz)'}
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
                            {c.web && <span className="pill gray" style={{ marginLeft: 6, fontSize: 10 }} title="Marketin saytından oxundu; qiymət yazılır, daimi link saxlanmır">sayt</span>}
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
            {pending && <p className="muted" style={{ fontSize: 12, margin: 0 }}>{stores.find((x) => x.id === pending)?.name ?? pending} mənbəsi çəkilir… (ilk dəfə 10–30 saniyə)</p>}
          </div>
        )}
        <div className="actions"><button className="btn secondary" onClick={onClose}>Bağla</button></div>
      </div>
    </div>
  );
}
