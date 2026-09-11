'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';

interface Line { product_id: string | null; name: string; price: number; qty: number; product_name?: string | null }
interface Receipt { id: string; user_id: string; store_id: string | null; total: number | null; items: Line[]; created_at: string }
interface Report { id: string; user_id: string; product_id: string; store_id: string | null; reason: string; note: string | null; created_at: string; products: { name: string; brand: string; size: string } | null }
interface Store { id: string; name: string }

const REASON: Record<string, string> = { outdated: 'Köhnədir', wrong: 'Səhvdir', missing: 'Bu marketdə yoxdur' };

/** Shoppers' receipts awaiting approval, and their price reports. */
export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [edits, setEdits] = useState<Record<string, { store_id: string; items: Line[] }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const r = await fetch('/api/receipts');
    const j = await r.json();
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? `HTTP ${r.status}` });
    setReceipts(j.receipts);
    setReports(j.reports);
    setStores(j.stores);
    setEdits(Object.fromEntries((j.receipts as Receipt[]).map((x) => [x.id, { store_id: x.store_id ?? '', items: x.items }])));
  };
  useEffect(() => { load(); }, []);

  const api = async (body: unknown) => {
    const r = await fetch('/api/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
    return j;
  };
  const approve = async (id: string) => {
    const e = edits[id];
    if (!e?.store_id) return setMsg({ ok: false, text: 'Market seçilməyib' });
    setBusy(id);
    try {
      const r = await api({ op: 'approve', id, store_id: e.store_id, items: e.items });
      setMsg({ ok: true, text: `${r.prices} qiymət yazıldı, istifadəçiyə +${r.points} xal.` });
      load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(null); }
  };
  const reject = async (id: string) => {
    if (!confirm('Çek rədd edilsin?')) return;
    setBusy(id);
    try { await api({ op: 'reject', id }); load(); } catch (err) { setMsg({ ok: false, text: (err as Error).message }); } finally { setBusy(null); }
  };
  const setLine = (id: string, i: number, patch: Partial<Line>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], items: prev[id].items.map((it, k) => (k === i ? { ...it, ...patch } : it)) } }));

  return (
    <Shell title="Çeklər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <p className="muted">İstifadəçilərin göndərdiyi çeklər. Qəbul edəndə işarəli sətirlər həmin marketin qiymətinə yazılır, istifadəçiyə xal gedir. Məhsulu tanınmayan sətir (—) qiymət yazmır; ID sahəsinə məhsul ID-si yazsan yazar.</p>
      {receipts.length === 0 && <p className="muted">Gözləyən çek yoxdur.</p>}
      {receipts.map((r) => {
        const e = edits[r.id];
        if (!e) return null;
        return (
          <div key={r.id} className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{new Date(r.created_at).toLocaleString('az-AZ')}</strong>
              <span className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.user_id.slice(0, 8)}</span>
              <select value={e.store_id} onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], store_id: ev.target.value } }))}>
                <option value="">— market —</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <span className="muted">Cəm: {r.total != null ? `${Number(r.total).toFixed(2)} ₼` : '—'}</span>
              <span style={{ flex: 1 }} />
              <button className="btn" disabled={!!busy} onClick={() => approve(r.id)}><CheckCircle size={14} /> {busy === r.id ? '…' : 'Qəbul et'}</button>
              <button className="btn ghost" disabled={!!busy} onClick={() => reject(r.id)} title="Rədd et"><Trash2 size={14} /></button>
            </div>
            <table style={{ marginTop: 8 }}>
              <thead><tr><th>Çekdə</th><th>Məhsul ID</th><th>Qiymət ₼</th><th>Say</th></tr></thead>
              <tbody>
                {e.items.map((it, i) => (
                  <tr key={i} style={{ opacity: it.product_id ? 1 : 0.6 }}>
                    <td>{it.name}{it.product_name ? <div className="muted" style={{ fontSize: 11 }}>{it.product_name}</div> : null}</td>
                    <td><input value={it.product_id ?? ''} placeholder="—" onChange={(ev) => setLine(r.id, i, { product_id: ev.target.value || null })} style={{ width: 200, fontFamily: 'monospace', fontSize: 12 }} /></td>
                    <td><input type="number" step="0.01" value={it.price} onChange={(ev) => setLine(r.id, i, { price: Number(ev.target.value) })} style={{ width: 90 }} /></td>
                    <td>{it.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <h2 style={{ marginTop: 32 }}>Qiymət şikayətləri</h2>
      {reports.length === 0 ? <p className="muted">Açıq şikayət yoxdur.</p> : (
        <table>
          <thead><tr><th>Vaxt</th><th>Məhsul</th><th>Market</th><th>Səbəb</th><th>Qeyd</th><th></th></tr></thead>
          <tbody>
            {reports.map((x) => (
              <tr key={x.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(x.created_at).toLocaleString('az-AZ')}</td>
                <td>{x.products ? `${x.products.brand} ${x.products.name} ${x.products.size}` : x.product_id}<div className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{x.product_id}</div></td>
                <td>{stores.find((s) => s.id === x.store_id)?.name ?? x.store_id ?? '—'}</td>
                <td>{REASON[x.reason] ?? x.reason}</td>
                <td className="muted">{x.note ?? ''}</td>
                <td style={{ textAlign: 'right' }}><button className="btn ghost" disabled={!!busy} onClick={async () => { setBusy(x.id); try { await api({ op: 'resolve_report', id: x.id }); setReports((p) => p.filter((y) => y.id !== x.id)); } finally { setBusy(null); } }}>Həll olundu</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
