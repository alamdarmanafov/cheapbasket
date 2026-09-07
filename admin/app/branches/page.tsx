'use client';
import { useEffect, useState } from 'react';
import { MapPin, Plus, Search, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Branch, Store, db, slugify } from '@/lib/supabase';
import type { WoltVenue } from '@/lib/wolt';

export default function Branches() {
  const [stores, setStores] = useState<Store[]>([]);
  const [rows, setRows] = useState<Branch[]>([]);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState('');
  const [resolving, setResolving] = useState(false);

  // Wolt branch import
  const [woltOpen, setWoltOpen] = useState(false);
  const [woltQuery, setWoltQuery] = useState('');
  const [woltStoreId, setWoltStoreId] = useState('');
  const [woltLoading, setWoltLoading] = useState(false);
  const [woltVenues, setWoltVenues] = useState<WoltVenue[]>([]);
  const [woltSelected, setWoltSelected] = useState<Set<string>>(new Set());
  const [woltError, setWoltError] = useState('');
  const [woltImporting, setWoltImporting] = useState(false);

  const searchWolt = async (query?: string, sid?: string) => {
    const q = (query ?? woltQuery).trim();
    if (!q || !(sid ?? woltStoreId)) return;
    setWoltLoading(true);
    setWoltError('');
    setWoltVenues([]);
    setWoltSelected(new Set());
    try {
      const res = await fetch(`/api/import/wolt/venues?q=${encodeURIComponent(q)}`);
      const j = await res.json() as { venues?: WoltVenue[]; error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const venues = j.venues ?? [];
      setWoltVenues(venues);
      if (!venues.length) setWoltError('Wolt-da filial tapılmadı');
      else setWoltSelected(new Set(venues.filter((v) => v.lat != null).map((v) => v.slug)));
    } catch (e) {
      setWoltError((e as Error).message);
    } finally {
      setWoltLoading(false);
    }
  };

  const importWolt = async () => {
    const toImport = woltVenues.filter((v) => woltSelected.has(v.slug) && v.lat != null && v.lng != null);
    if (!toImport.length) return;
    setWoltImporting(true);
    const branchRows: Branch[] = toImport.map((v) => ({
      id: slugify(`${woltStoreId} ${v.name} ${(v.address ?? '').slice(0, 20)}`),
      store_id: woltStoreId,
      name: v.name,
      address: v.address ?? '',
      lat: v.lat!,
      lng: v.lng!,
      open_until: null,
      open_from: null,
      always_open: false,
      maps_url: v.url ?? null,
      phone: null,
    }));
    const error = await db.upsert('branches', branchRows as unknown as Record<string, unknown>[]).then(() => null, (e: Error) => e.message);
    setWoltImporting(false);
    setMsg({ ok: !error, text: error ?? `${branchRows.length} filial əlavə edildi` });
    if (!error) { setWoltOpen(false); setWoltVenues([]); load(); }
  };

  /** Paste a Google Maps link / address → fill name, address and coordinates. */
  const resolve = async () => {
    if (!edit || !link.trim()) return;
    setResolving(true);
    try {
      const res = await fetch('/api/geo/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: link }) });
      const j = (await res.json()) as { lat: number; lng: number; name?: string; address?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setEdit({
        ...edit,
        lat: j.lat,
        lng: j.lng,
        name: edit.name || j.name || '',
        address: edit.address || j.address || '',
        maps_url: /^https?:\/\//i.test(link.trim()) ? link.trim() : edit.maps_url ?? null,
      });
      setMsg({ ok: true, text: `Koordinat tapıldı: ${j.lat.toFixed(5)}, ${j.lng.toFixed(5)}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setResolving(false);
    }
  };

  const load = async () => {
    const [s, b] = await Promise.all([db.select<Store>('stores', { order: 'name' }), db.select<Branch>('branches', { order: 'name' })]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], []] as [Store[], Branch[]]; });
    setStores(s);
    setRows(b);
  };
  useEffect(() => { load(); }, []);

  const save = async (b: Branch) => {
    const row = { ...b, id: b.id || slugify(`${b.store_id} ${b.name} ${b.address.slice(0, 20)}`), lat: Number(b.lat), lng: Number(b.lng), open_until: b.open_until || null, open_from: b.open_from?.trim() || null, always_open: !!b.always_open, maps_url: b.maps_url?.trim() || null, phone: b.phone?.trim() || null };
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
        <span className="muted">Google Maps-də filialı tap → "Paylaş" → linki kopyala → "Yeni filial"də yapışdır. Ad, ünvan və koordinat avtomatik doldurulur.</span>
        <button className="btn secondary" style={{ marginLeft: 'auto' }} disabled={!stores.length} onClick={() => {
          if (woltOpen) { setWoltOpen(false); return; }
          const first = stores[0];
          const name = first?.name ?? '';
          setWoltStoreId(first?.id ?? '');
          setWoltQuery(name);
          setWoltVenues([]); setWoltSelected(new Set()); setWoltError('');
          setWoltOpen(true);
          if (name && first?.id) searchWolt(name, first.id);
        }}><Search size={14} /> Wolt-dan çək</button>
        <button className="btn" disabled={!stores.length} onClick={() => { setLink(''); setEdit({ id: '', store_id: stores[0]?.id ?? '', name: '', address: '', lat: 40.4093, lng: 49.8671, open_until: '23:00', open_from: '08:00', always_open: false, maps_url: '', phone: '' }); }}><Plus size={14} /> Yeni filial</button>
      </div>

      {woltOpen && (
        <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <label style={{ flex: '0 0 auto' }}>
              <span style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>Market</span>
              <select value={woltStoreId} onChange={(e) => {
                const sid = e.target.value;
                const name = stores.find((s) => s.id === sid)?.name ?? '';
                setWoltStoreId(sid);
                setWoltQuery(name);
                setWoltVenues([]); setWoltSelected(new Set()); setWoltError('');
                searchWolt(name, sid);
              }} style={{ minWidth: 120 }}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ flex: 1, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 4 }}>Wolt-da axtarış (şirkət adı)</span>
              <input value={woltQuery} onChange={(e) => setWoltQuery(e.target.value)} placeholder="məs. Araz, Bravo, Kontakt" onKeyDown={(e) => e.key === 'Enter' && searchWolt()} />
            </label>
            <button className="btn" disabled={woltLoading || !woltQuery.trim() || !woltStoreId} onClick={() => searchWolt()}>
              {woltLoading ? 'Axtarılır…' : <><Search size={14} /> Axtar</>}
            </button>
            <button className="btn ghost" onClick={() => setWoltOpen(false)}><X size={14} /></button>
          </div>

          {woltError && <div className="alert err" style={{ marginTop: 10 }}>{woltError}</div>}

          {woltVenues.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{woltVenues.length} filial tapıldı — seç:</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setWoltSelected(new Set(woltVenues.filter((v) => v.lat != null).map((v) => v.slug)))}>Hamısı</button>
                  <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setWoltSelected(new Set())}>Heç biri</button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                {woltVenues.map((v) => (
                  <label key={v.slug} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: woltSelected.has(v.slug) ? '#E0F2FE' : '#fff', borderRadius: 8, cursor: v.lat != null ? 'pointer' : 'not-allowed', border: '1px solid #E2E8F0', opacity: v.lat == null ? 0.5 : 1 }}>
                    <input type="checkbox" checked={woltSelected.has(v.slug)} disabled={v.lat == null} style={{ marginTop: 2, width: 'auto', flexShrink: 0 }}
                      onChange={(e) => setWoltSelected((prev) => { const s = new Set(prev); e.target.checked ? s.add(v.slug) : s.delete(v.slug); return s; })} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                      {v.address && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{v.address}</div>}
                      {v.lat != null ? (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>{v.lat.toFixed(5)}, {v.lng!.toFixed(5)}</div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Koordinat yoxdur — əlavə edilə bilməz</div>
                      )}
                    </div>
                    <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0EA5E9', flexShrink: 0, alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>Wolt →</a>
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn" disabled={woltImporting || woltSelected.size === 0} onClick={importWolt}>
                  {woltImporting ? 'Əlavə edilir…' : `${woltSelected.size} filial əlavə et`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <table>
        <thead><tr><th>Market</th><th>Filial</th><th>Ünvan</th><th>Koordinat</th><th>Açıq</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td><span className="avatar" style={{ background: store(b.store_id)?.color ?? '#999' }}>{store(b.store_id)?.initial}</span>{store(b.store_id)?.name ?? b.store_id}</td>
              <td><b>{b.name}</b></td>
              <td className="muted">{b.address}</td>
              <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}><a href={b.maps_url || `https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer"><MapPin size={12} style={{ verticalAlign: -2 }} /> {Number(b.lat).toFixed(5)}, {Number(b.lng).toFixed(5)}</a></td>
              <td className="muted">{b.always_open ? '24 saat' : b.open_from || b.open_until ? `${b.open_from ?? '…'}–${b.open_until ?? '…'}` : '—'}</td>
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
            <div style={{ marginTop: 14, padding: 12, background: '#FAFAFA', borderRadius: 12 }}>
              <label style={{ fontSize: 12, color: '#6B7280' }}>Google Maps linki, "lat, lng" və ya ünvan</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.app.goo.gl/… və ya Nərimanov, Ə. Ələkbərov 12" style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && resolve()} />
                <button className="btn secondary" disabled={resolving || !link.trim()} onClick={resolve}><MapPin size={14} /> {resolving ? 'Axtarılır…' : 'Tap'}</button>
              </div>
              <iframe title="map" src={`https://www.google.com/maps?q=${edit.lat},${edit.lng}&z=16&output=embed`} style={{ width: '100%', height: 180, border: 0, borderRadius: 10, marginTop: 10 }} loading="lazy" />
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label>Market<select value={edit.store_id} onChange={(e) => setEdit({ ...edit, store_id: e.target.value })}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label>Filial adı<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Araz Market Nərimanov" /></label>
              <label className="full">Ünvan<input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="Ə. Ələkbərov küç. 12, Nərimanov" /></label>
              <label>Lat<input type="number" step="any" value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: Number(e.target.value) })} /></label>
              <label>Lng<input type="number" step="any" value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: Number(e.target.value) })} /></label>
              <label>Açılış (saat)<input value={edit.open_from ?? ''} onChange={(e) => setEdit({ ...edit, open_from: e.target.value })} placeholder="08:00" disabled={!!edit.always_open} /></label>
              <label>Bağlanış (saat)<input value={edit.open_until ?? ''} onChange={(e) => setEdit({ ...edit, open_until: e.target.value })} placeholder="23:00" disabled={!!edit.always_open} /></label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={!!edit.always_open} onChange={(e) => setEdit({ ...edit, always_open: e.target.checked })} style={{ width: 'auto' }} /> 24 saat açıqdır</label>
              <label>Telefon<input value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+994 12 000 00 00" /></label>
              <label className="full">Google Maps linki (tətbiqdə "Google Maps-də aç")<input value={edit.maps_url ?? ''} onChange={(e) => setEdit({ ...edit, maps_url: e.target.value })} placeholder="https://maps.app.goo.gl/…" /></label>
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
