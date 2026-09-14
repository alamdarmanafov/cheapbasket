'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, Play, X } from 'lucide-react';
import { Shell } from '@/components/Shell';

interface Row { id: string; store_id: string; ext_id: string; product_id: string; feed_name: string; feed_price: number | null; feed_regular: number | null; feed_barcode: string | null; score: number; created_at: string; products: { brand: string; name: string; size: string; barcode: string | null } | null }
interface StoreInfo { id: string; name: string; color: string; feed: boolean }
interface RunResult { store_id: string; sources: number; items: number; candidates: number; linked: number; queued: number; error?: string }

/**
 * The pairs the batch matcher was not sure about, store by store: our
 * product on the left, the feed's line on the right, the score between.
 * Yes links and prices it; no is remembered so it is not asked again.
 */
export default function Matches() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [store, setStore] = useState<string>('');
  const [minScore, setMinScore] = useState(0.6);

  const load = async () => {
    const r = await fetch('/api/autolink');
    const j = (await r.json()) as { rows?: Row[]; stores?: StoreInfo[]; error?: string };
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? `HTTP ${r.status}` });
    setRows(j.rows ?? []);
    setStores(j.stores ?? []);
  };
  useEffect(() => { load(); }, []);

  const decide = async (ids: string[], decision: 'accept' | 'reject') => {
    if (!ids.length) return;
    setBusy(ids.length === 1 ? ids[0] : 'bulk');
    try {
      const r = await fetch('/api/autolink', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, decision }) });
      const j = (await r.json()) as { done?: number; errors?: string[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setRows((p) => p.filter((x) => !ids.includes(x.id)));
      setMsg({ ok: !(j.errors ?? []).length, text: `${j.done} ${decision === 'accept' ? 'qəbul edildi, qiymət yazıldı' : 'rədd edildi'}${(j.errors ?? []).length ? ` · xəta: ${j.errors?.[0]}` : ''}` });
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const run = async (storeId: string) => {
    setBusy(`run:${storeId}`);
    try {
      const r = await fetch('/api/autolink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ store_id: storeId }) });
      const j = (await r.json()) as RunResult & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      const name = stores.find((s) => s.id === storeId)?.name ?? storeId;
      setMsg({ ok: !j.error, text: j.error ? `${name}: ${j.error}` : `${name}: ${j.items} sətir mənbədə · ${j.candidates} qiymətsiz məhsul · ${j.linked} avtomatik link + qiymət · ${j.queued} növbəyə` });
      await load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const visible = useMemo(() => rows.filter((r) => (!store || r.store_id === store) && Number(r.score) >= minScore), [rows, store, minScore]);
  const byStore = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.store_id, (m.get(r.store_id) ?? 0) + 1));
    return m;
  }, [rows]);
  const storeOf = (id: string) => stores.find((s) => s.id === id);

  return (
    <Shell title="Uyğunlaşdırma növbəsi">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <p className="note" style={{ marginTop: 0 }}>
        Gecə işi hər marketin mənbəsini bizim qiymətsiz məhsullarla tutuşdurur: barkod eynidirsə və ya ad 85%+ oxşardırsa özü link edib qiyməti yazır; 60–85% olanlar bura düşür. "Bəli" qiyməti yazır və linki saxlayır, "Yox" bir daha soruşulmur.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {stores.map((s) => (
          <div key={s.id} className="card" style={{ padding: 12, border: store === s.id ? `2px solid ${s.color}` : '1px solid #ECECEE', cursor: 'pointer' }} onClick={() => setStore(store === s.id ? '' : s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: s.color, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12 }}>{s.name.slice(0, 1)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{byStore.get(s.id) ?? 0} növbədə{!s.feed ? ' · mənbə yoxdur' : ''}</div>
              </div>
            </div>
            <button className="btn secondary" style={{ marginTop: 8, width: '100%', fontSize: 12, justifyContent: 'center' }} disabled={!s.feed || !!busy} onClick={(e) => { e.stopPropagation(); run(s.id); }}>
              {busy === `run:${s.id}` ? 'İşləyir…' : <><Play size={12} /> İndi işlət</>}
            </button>
          </div>
        ))}
      </div>

      <div className="toolbar">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          Min oxşarlıq
          <input type="range" min={0.6} max={0.85} step={0.05} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
          <b>{Math.round(minScore * 100)}%</b>
        </label>
        <span className="muted" style={{ fontSize: 12 }}>{visible.length} cüt</span>
        <button className="btn" style={{ marginLeft: 'auto' }} disabled={!!busy || !visible.length} onClick={() => confirm(`${visible.length} cütün hamısı qəbul edilsin? Qiymətlər yazılacaq.`) && decide(visible.map((r) => r.id), 'accept')}>
          <Check size={14} /> Görünənlərin hamısına bəli ({visible.length})
        </button>
      </div>

      <table>
        <thead><tr><th>Market</th><th>Bizim məhsul</th><th>Mənbədəki sətir</th><th>Oxşarlıq</th><th>Qiymət</th><th></th></tr></thead>
        <tbody>
          {visible.map((r) => {
            const s = storeOf(r.store_id);
            return (
              <tr key={r.id}>
                <td><span style={{ padding: '2px 8px', borderRadius: 999, background: s?.color ?? '#999', color: '#fff', fontSize: 11, fontWeight: 700 }}>{s?.name ?? r.store_id}</span></td>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.products ? `${r.products.brand} ${r.products.name}`.trim() : r.product_id}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{r.products?.size ?? ''}{r.products?.barcode ? ` · ${r.products.barcode}` : ''}</div>
                </td>
                <td>
                  <div style={{ fontSize: 13 }}>{r.feed_name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{r.feed_barcode ?? ''}</div>
                </td>
                <td><b style={{ color: Number(r.score) >= 0.75 ? '#15803D' : '#B45309' }}>{Math.round(Number(r.score) * 100)}%</b></td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                  {r.feed_price != null ? `${Number(r.feed_price).toFixed(2)} ₼` : '—'}
                  {r.feed_regular != null && <span className="muted" style={{ fontWeight: 400, textDecoration: 'line-through', marginLeft: 6 }}>{Number(r.feed_regular).toFixed(2)}</span>}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn" style={{ marginRight: 6 }} disabled={!!busy} onClick={() => decide([r.id], 'accept')}><Check size={14} /> Bəli</button>
                  <button className="btn ghost" disabled={!!busy} onClick={() => decide([r.id], 'reject')}><X size={14} /> Yox</button>
                </td>
              </tr>
            );
          })}
          {visible.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 30 }}>Növbə boşdur. Market kartında "İndi işlət" bas və ya gecə işini gözlə (hər saat bir market).</td></tr>}
        </tbody>
      </table>
    </Shell>
  );
}
