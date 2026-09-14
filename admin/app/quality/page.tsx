'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';

interface Named { name: string; brand?: string; size?: string }
interface Q { id: string; product_id: string; store_id: string; old_price: number | null; new_price: number; discount_price: number | null; reference: number; source: string | null; created_at: string; products: Named | null; stores: { name: string } | null }
interface R { id: string; product_id: string; store_id: string; notified: number; created_at: string; products: Named | null; stores: { name: string } | null }
interface Data {
  total: number; score: number;
  flags: Record<'barcode' | 'image' | 'size' | 'category' | 'twoStores' | 'fresh', number>;
  counts: Record<string, number>;
  perStore: Array<{ id: string; name: string; color: string; priced: number; stale: number }>;
  fixes: Array<{ id: string; name: string; missing: string[]; hot: number; stores: number }>;
  queues: { quarantine: number; requests: number; partners: number; matches: number; pending: number };
  quarantine: Q[]; requests: R[];
}

const FLAG_LABEL: Record<keyof Data['flags'], string> = { barcode: 'Barkodu var', image: 'Şəkli var', size: 'Ölçü oxunur', category: 'Kateqoriyası var', twoStores: '≥ 2 marketdə qiymət', fresh: '14 gündən təzə' };
const nameOf = (p: Named | null, id: string) => (p ? `${p.brand ?? ''} ${p.name} ${p.size ?? ''}`.trim() : id);

/**
 * One page that says how good the catalogue is and what to fix first: the
 * six health measures as percentages, per-store staleness, the twenty
 * products shoppers touch most that are missing something, and the parked
 * prices waiting for a yes or no.
 */
export default function Quality() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    setD(null);
    fetch('/api/quality').then((r) => r.json()).then((j) => (j.error ? setMsg({ ok: false, text: j.error }) : setD(j))).catch((e: Error) => setMsg({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  const decide = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      const r = await fetch('/api/quality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'quarantine', id, accept }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setD((prev) => (prev ? { ...prev, quarantine: prev.quarantine.filter((q) => q.id !== id), queues: { ...prev.queues, quarantine: prev.queues.quarantine - 1 } } : prev));
      setMsg({ ok: true, text: accept ? 'Qiymət yazıldı' : 'Rədd edildi, köhnə qiymət qalır' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const closeRequest = async (id: string) => {
    setBusy(id);
    await fetch('/api/quality', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'close_request', id }) }).catch(() => undefined);
    setD((prev) => (prev ? { ...prev, requests: prev.requests.filter((r) => r.id !== id) } : prev));
    setBusy(null);
  };

  return (
    <Shell title="Keyfiyyət">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      {!d ? (
        <p className="muted">Hesablanır…</p>
      ) : (
        <>
          <div className="card" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Kataloq sağlamlığı</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: d.score >= 80 ? '#16A34A' : d.score >= 60 ? '#D97706' : '#E53935' }}>{d.score}%</div>
              <div className="muted" style={{ fontSize: 12 }}>{d.total} məhsul</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, flex: 1 }}>
              {(Object.keys(FLAG_LABEL) as Array<keyof Data['flags']>).map((k) => (
                <div key={k} style={{ border: '1px solid #eee', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>{FLAG_LABEL[k]}</span><b>{d.flags[k]}%</b></div>
                  <div style={{ height: 6, background: '#eee', borderRadius: 3, marginTop: 6 }}><div style={{ width: `${d.flags[k]}%`, height: 6, borderRadius: 3, background: d.flags[k] >= 80 ? '#16A34A' : d.flags[k] >= 50 ? '#D97706' : '#E53935' }} /></div>
                </div>
              ))}
            </div>
            <button className="btn secondary" onClick={load}><RefreshCw size={14} /> Yenilə</button>
          </div>

          <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              ['Karantin', d.queues.quarantine, '#quarantine'],
              ['Açıq sorğular', d.queues.requests, '#requests'],
              ['Partnyor yükləmələri', d.queues.partners, '/partners'],
              ['Uyğunlaşdırma', d.queues.matches, '/matches'],
              ['Növbə', d.queues.pending, '/pending'],
            ].map(([label, n, href]) => (
              <Link key={String(label)} href={String(href)} className="pill" style={{ background: Number(n) ? '#FEF3E2' : '#F1F1F3', color: Number(n) ? '#D97706' : '#6B7280', padding: '6px 12px', borderRadius: 999, textDecoration: 'none' }}>
                {label}: <b>{n}</b>
              </Link>
            ))}
          </div>

          <div className="card">
            <h2>Marketlər üzrə</h2>
            <table>
              <thead><tr><th>Market</th><th style={{ textAlign: 'right' }}>Qiymətli məhsul</th><th style={{ textAlign: 'right' }}>14 gündən köhnə</th></tr></thead>
              <tbody>
                {d.perStore.map((s) => (
                  <tr key={s.id}><td><span className="avatar" style={{ background: s.color }}>{s.name.slice(0, 1)}</span> {s.name}</td><td style={{ textAlign: 'right' }}>{s.priced}</td><td style={{ textAlign: 'right', color: s.stale ? '#D97706' : undefined }}>{s.stale}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Əvvəlcə düzəldiləsi 20</h2>
            <p className="muted" style={{ fontSize: 12 }}>Son 30 gündə ən çox skan / səbət / izləmə alan və nəsə çatışmayan məhsullar.</p>
            <table>
              <thead><tr><th>Məhsul</th><th>Çatışmır</th><th style={{ textAlign: 'right' }}>Toxunuş</th><th style={{ textAlign: 'right' }}>Market</th></tr></thead>
              <tbody>
                {d.fixes.map((f) => (
                  <tr key={f.id}>
                    <td><Link href={`/products?q=${encodeURIComponent(f.name)}`}>{f.name}</Link></td>
                    <td>{f.missing.map((m) => <span key={m} className="pill" style={{ marginRight: 4, background: '#FEF3E2', color: '#D97706' }}>{m}</span>)}</td>
                    <td style={{ textAlign: 'right' }}>{f.hot}</td>
                    <td style={{ textAlign: 'right' }}>{f.stores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" id="quarantine">
            <h2><ShieldAlert size={18} style={{ verticalAlign: -3 }} /> Karantin — tarixçədən çox kənar qiymətlər ({d.quarantine.length})</h2>
            <p className="muted" style={{ fontSize: 12 }}>Feed, CSV, çek və ya istifadəçidən gələn qiymət tarixçəsindən 50%-dən çox fərqlənəndə yazılmır, bura düşür. "Yaz" bazaya yazır, "Rədd" köhnə qiyməti saxlayır. Faiz: app_settings → quality.anomaly_pct.</p>
            {d.quarantine.length === 0 ? <p className="muted">Boşdur.</p> : (
              <table>
                <thead><tr><th>Məhsul</th><th>Market</th><th style={{ textAlign: 'right' }}>Bazada</th><th style={{ textAlign: 'right' }}>Gələn</th><th style={{ textAlign: 'right' }}>Tarixçə</th><th>Mənbə</th><th>Vaxt</th><th></th></tr></thead>
                <tbody>
                  {d.quarantine.map((q) => (
                    <tr key={q.id}>
                      <td>{nameOf(q.products, q.product_id)}</td>
                      <td>{q.stores?.name ?? q.store_id}</td>
                      <td style={{ textAlign: 'right' }}>{q.old_price != null ? Number(q.old_price).toFixed(2) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#E53935' }}>{Number(q.new_price).toFixed(2)}{q.discount_price != null ? <span className="muted"> / {Number(q.discount_price).toFixed(2)}</span> : null}</td>
                      <td style={{ textAlign: 'right' }}>{Number(q.reference).toFixed(2)}</td>
                      <td><span className="pill gray">{q.source ?? '—'}</span></td>
                      <td className="muted" style={{ fontSize: 12 }}>{new Date(q.created_at).toLocaleString('az-AZ')}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn" style={{ marginRight: 6 }} disabled={busy === q.id} onClick={() => decide(q.id, true)}><CheckCircle size={14} /> Yaz</button>
                        <button className="btn secondary" disabled={busy === q.id} onClick={() => decide(q.id, false)}><XCircle size={14} /> Rədd</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" id="requests">
            <h2>Açıq qiymət sorğuları ({d.requests.length})</h2>
            <p className="muted" style={{ fontSize: 12 }}>İstifadəçi "bu marketdə neçəyədir?" soruşub; hər saat o marketə gedənlərə push gedir, cavab qiymət bildirişi kimi "Çeklər" səhifəsinə düşür.</p>
            {d.requests.length === 0 ? <p className="muted">Boşdur.</p> : (
              <table>
                <thead><tr><th>Məhsul</th><th>Market</th><th style={{ textAlign: 'right' }}>Soruşulan</th><th>Vaxt</th><th></th></tr></thead>
                <tbody>
                  {d.requests.map((r) => (
                    <tr key={r.id}>
                      <td>{nameOf(r.products, r.product_id)}</td>
                      <td>{r.stores?.name ?? r.store_id}</td>
                      <td style={{ textAlign: 'right' }}>{r.notified}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString('az-AZ')}</td>
                      <td><button className="btn secondary" disabled={busy === r.id} onClick={() => closeRequest(r.id)}>Bağla</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
