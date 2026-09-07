'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Branch, Store, db, slugify } from '@/lib/supabase';

export default function Branches() {
  const [stores, setStores] = useState<Store[]>([]);
  const [rows, setRows] = useState<Branch[]>([]);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const [s, b] = await Promise.all([db.select<Store>('stores', { order: 'name' }), db.select<Branch>('branches', { order: 'name' })]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], []] as [Store[], Branch[]]; });
    setStores(s);
    setRows(b);
  };
  useEffect(() => { load(); }, []);

  const save = async (b: Branch) => {
    const row = { ...b, id: b.id || slugify(`${b.store_id} ${b.name} ${b.address.slice(0, 20)}`), lat: Number(b.lat), lng: Number(b.lng), open_until: b.open_until || null };
    const error = await db.upsert('branches', [row]).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !error, text: error ?? `${row.name} yadda saxlanıldı` });
    if (!error) { setEdit(null); load(); }
  };
  const remove = async (b: Branch) => {
    if (!confirm(`${b.name} silinsin?`)) return;
    const error = await db.delete('branches', { id: b.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !error, text: error ?? 'Silindi' });
    load();
  };
  const store = (id: string) => stores.find((s) => s.id === id);

  return (
    <Shell title="Filiallar">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <span className="muted">Koordinatı Google Maps-də filialın üstünə sağ klik → ilk sətirdəki rəqəmlər (lat, lng).</span>
        <button className="btn" style={{ marginLeft: 'auto' }} disabled={!stores.length} onClick={() => setEdit({ id: '', store_id: stores[0]?.id ?? '', name: '', address: '', lat: 40.4093, lng: 49.8671, open_until: '23:00' })}><Plus size={14} /> Yeni filial</button>
      </div>
      <table>
        <thead><tr><th>Market</th><th>Filial</th><th>Ünvan</th><th>Koordinat</th><th>Açıq</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td><span className="avatar" style={{ background: store(b.store_id)?.color ?? '#999' }}>{store(b.store_id)?.initial}</span>{store(b.store_id)?.name ?? b.store_id}</td>
              <td><b>{b.name}</b></td>
              <td className="muted">{b.address}</td>
              <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}><a href={`https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer">{b.lat}, {b.lng}</a></td>
              <td className="muted">{b.open_until ?? '—'}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="btn ghost" onClick={() => setEdit(b)}>Düzəlt</button>
                <button className="btn ghost" onClick={() => remove(b)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 30 }}>Filial yoxdur. Tətbiqdə xəritə və "ən yaxın filial" buradan gəlir.</td></tr>}
        </tbody>
      </table>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.id ? 'Filialı düzəlt' : 'Yeni filial'}</h2>
              <button className="btn ghost" onClick={() => setEdit(null)}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label>Market<select value={edit.store_id} onChange={(e) => setEdit({ ...edit, store_id: e.target.value })}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Filial adı<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Araz Market Nərimanov" /></label>
              <label className="full">Ünvan<input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="Ə. Ələkbərov küç. 12, Nərimanov" /></label>
              <label>Lat<input type="number" step="any" value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: Number(e.target.value) })} /></label>
              <label>Lng<input type="number" step="any" value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: Number(e.target.value) })} /></label>
              <label>Açıqdır (saat)<input value={edit.open_until ?? ''} onChange={(e) => setEdit({ ...edit, open_until: e.target.value })} placeholder="23:00" /></label>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => setEdit(null)}>Ləğv et</button>
              <button className="btn" disabled={!edit.name || !edit.address} onClick={() => save(edit)}>Saxla</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
