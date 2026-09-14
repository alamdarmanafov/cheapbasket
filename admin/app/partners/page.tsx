'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';

interface Upload { id: string; store_id: string; filename: string | null; note: string | null; row_count: number; status: string; applied: number; created_at: string; decided_at: string | null; stores: { name: string } | null }
interface Row { barcode: string | null; name: string; brand: string | null; size: string | null; price: number; product_id: string | null; product_name: string | null; current: number | null }

/**
 * Lists a store handed over with its own link. Each one is matched to the
 * catalogue when opened; the admin unticks what looks wrong and applies the
 * rest as that store's prices (source "partner"; a price far off history
 * still parks in quarantine).
 */
export default function Partners() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [open, setOpen] = useState<{ upload: Upload; rows: Row[]; keep: Set<number> } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetch('/api/partners').then((r) => r.json()).then((j) => setUploads(j.uploads ?? [])).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const openOne = async (u: Upload) => {
    setBusy(true);
    try {
      const j = await fetch(`/api/partners?id=${u.id}`).then((r) => r.json());
      if (j.error) throw new Error(j.error);
      const rows = j.rows as Row[];
      setOpen({ upload: u, rows, keep: new Set(rows.map((r, i) => (r.product_id ? i : -1)).filter((i) => i >= 0)) });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const decide = async (op: 'apply' | 'reject') => {
    if (!open) return;
    const items = op === 'apply' ? open.rows.filter((_, i) => open.keep.has(i)).map((r) => ({ product_id: r.product_id, price: r.price })) : [];
    if (op === 'apply' && !confirm(`${items.length} qiymət "${open.upload.stores?.name ?? open.upload.store_id}" marketinə yazılsın?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op, id: open.upload.id, items }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setMsg({ ok: true, text: op === 'apply' ? `${j.applied} qiymət yazıldı${j.parked ? `, ${j.parked} karantinə düşdü` : ''}` : 'Rədd edildi' });
      setOpen(null);
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Partnyor yükləmələri">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="note" style={{ marginBottom: 14 }}>Hər marketin öz linki "Marketlər" səhifəsindədir. Market faylı yükləyir, siyahı bura düşür; heç nə avtomatik yazılmır.</div>
      {open ? (
        <div className="card">
          <h2>{open.upload.stores?.name ?? open.upload.store_id} · {open.upload.filename ?? 'fayl'} · {open.rows.length} sətir</h2>
          {open.upload.note && <p className="muted">Qeyd: {open.upload.note}</p>}
          <p className="muted" style={{ fontSize: 12 }}>{open.rows.filter((r) => r.product_id).length} sətir kataloqdakı məhsulla eşləşdi; eşləşməyənlər yazılmır. İşarəni götürüb sətri kənarda qoymaq olar.</p>
          <div style={{ overflowX: 'auto', maxHeight: 520 }}>
            <table>
              <thead><tr><th></th><th>Faylda</th><th>Kataloqda</th><th style={{ textAlign: 'right' }}>Bazada</th><th style={{ textAlign: 'right' }}>Gələn</th></tr></thead>
              <tbody>
                {open.rows.map((r, i) => (
                  <tr key={i} style={{ opacity: r.product_id ? 1 : 0.5 }}>
                    <td><input type="checkbox" disabled={!r.product_id} checked={open.keep.has(i)} onChange={(e) => { const keep = new Set(open.keep); if (e.target.checked) keep.add(i); else keep.delete(i); setOpen({ ...open, keep }); }} /></td>
                    <td>{[r.brand, r.name, r.size].filter(Boolean).join(' ')}{r.barcode ? <span className="muted"> · {r.barcode}</span> : null}</td>
                    <td>{r.product_name ?? <span className="pill gray">eşləşmədi</span>}</td>
                    <td style={{ textAlign: 'right' }}>{r.current != null ? r.current.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" disabled={busy} onClick={() => decide('apply')}><CheckCircle size={14} /> Seçilənləri yaz ({open.keep.size})</button>
            <button className="btn secondary" disabled={busy} onClick={() => decide('reject')}><XCircle size={14} /> Rədd et</button>
            <button className="btn ghost" disabled={busy} onClick={() => setOpen(null)}>Geri</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Market</th><th>Fayl</th><th style={{ textAlign: 'right' }}>Sətir</th><th>Status</th><th>Vaxt</th><th></th></tr></thead>
            <tbody>
              {uploads.length === 0 && <tr><td colSpan={6} className="muted">Hələ yükləmə yoxdur.</td></tr>}
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td>{u.stores?.name ?? u.store_id}</td>
                  <td>{u.filename ?? '—'}{u.note ? <span className="muted"> · {u.note}</span> : null}</td>
                  <td style={{ textAlign: 'right' }}>{u.row_count}</td>
                  <td><span className={`pill ${u.status === 'pending' ? 'orange' : u.status === 'applied' ? 'green' : 'gray'}`}>{u.status === 'pending' ? 'gözləyir' : u.status === 'applied' ? `yazıldı (${u.applied})` : 'rədd'}</span></td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(u.created_at).toLocaleString('az-AZ')}</td>
                  <td>{u.status === 'pending' && <button className="btn" disabled={busy} onClick={() => openOne(u)}>Bax</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
