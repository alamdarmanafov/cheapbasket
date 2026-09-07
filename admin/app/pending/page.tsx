'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, CheckCheck, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { useCategories } from '@/lib/supabase';

interface PendingProduct {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  size: string | null;
  image_url: string | null;
  category: string | null;
  store_id: string | null;
  source_name: string | null;
  created_at: string;
}

export default function PendingPage() {
  const [items, setItems] = useState<PendingProduct[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { names: categories } = useCategories();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pending');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setItems(j.data ?? []);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const api = async (body: unknown) => {
    const res = await fetch('/api/pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j;
  };

  const approve = async (item: PendingProduct) => {
    setBusy(item.id);
    setMsg(null);
    try {
      await api({ op: 'approve', id: item.id, category: cats[item.id] ?? item.category ?? '' });
      setMsg({ ok: true, text: `"${item.name}" məhsullar siyahısına əlavə edildi.` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const reject = async (item: PendingProduct) => {
    if (!confirm(`"${item.name}" növbədən silinsin?`)) return;
    setBusy(item.id + '-del');
    setMsg(null);
    try {
      await api({ op: 'reject', id: item.id });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    if (!confirm(`${items.length} məhsulun hamısı qəbul edilsin?`)) return;
    setBusy('all');
    setMsg(null);
    try {
      const r = await api({ op: 'approve_all' });
      setMsg({ ok: true, text: `${r.count} məhsul qəbul edildi.` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const count = items.length;
  const title = count > 0 ? `Təsdiq növbəsi (${count})` : 'Təsdiq növbəsi';

  return (
    <Shell title={title}>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            Sinxronizasiya zamanı tapılan yeni məhsullar admin təsdiqini gözləyir. Kateqoriyanı seçib qəbul et, ya da sil.
          </p>
          {count > 0 && (
            <button className="btn" disabled={busy === 'all'} onClick={approveAll}>
              <CheckCheck size={14} /> {busy === 'all' ? 'Qəbul edilir…' : `Hamısını qəbul et (${count})`}
            </button>
          )}
        </div>

        {loading ? (
          <p className="muted">Yüklənir…</p>
        ) : count === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            Növbə boşdur. Yeni məhsullar növbəti sinxronizasiyadan sonra burada görünəcək.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Şəkil</th>
                  <th>Məhsul</th>
                  <th>Kateqoriya</th>
                  <th>Mənbə</th>
                  <th>Tarix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: '#F3F4F6', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                          📦
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {item.brand && <span className="muted" style={{ marginRight: 4, fontWeight: 400 }}>{item.brand}</span>}
                        {item.name}
                      </div>
                      {item.size && <div className="muted" style={{ fontSize: 12 }}>{item.size}</div>}
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.id}</div>
                    </td>
                    <td>
                      <select
                        value={cats[item.id] ?? item.category ?? ''}
                        onChange={(e) => setCats((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        style={{ fontSize: 13, minWidth: 140 }}
                      >
                        <option value="">— seç —</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      <div>{item.source_name ?? '—'}</div>
                      {item.store_id && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.store_id}</div>}
                    </td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleString('az-AZ')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button
                        className="btn"
                        disabled={!!busy}
                        onClick={() => approve(item)}
                        style={{ marginRight: 4 }}
                        title="Məhsullar siyahısına əlavə et"
                      >
                        <CheckCircle size={14} /> {busy === item.id ? '…' : 'Qəbul et'}
                      </button>
                      <button
                        className="btn ghost"
                        disabled={!!busy}
                        onClick={() => reject(item)}
                        title="Növbədən sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
