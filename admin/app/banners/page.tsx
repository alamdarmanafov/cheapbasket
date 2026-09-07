'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Banner, db } from '@/lib/supabase';

const EMPTY: Banner = { id: '', title: '', subtitle: '', image_url: '', bg_color: '#E53935', text_color: '#FFFFFF', link: '', sort: 0, active: true, starts_at: null, ends_at: null };
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export default function Banners() {
  const [rows, setRows] = useState<Banner[]>([]);
  const [edit, setEdit] = useState<Banner | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setRows((await db.select<Banner>('banners', { order: 'sort' }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return []; })));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    const row: Record<string, unknown> = { ...edit, subtitle: edit.subtitle?.trim() || null, image_url: edit.image_url?.trim() || null, link: edit.link?.trim() || null };
    if (!edit.id) delete row.id;
    const err = await db.upsert('banners', [row]).then(() => null, (e: Error) => e.message);
    setBusy(false);
    setMsg({ ok: !err, text: err ?? `"${edit.title}" yadda saxlanıldı — tətbiqdə dərhal görünür` });
    if (!err) { setEdit(null); load(); }
  };
  const remove = async (b: Banner) => {
    if (!confirm(`"${b.title}" silinsin?`)) return;
    const err = await db.delete('banners', { id: b.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !err, text: err ?? 'Silindi' });
    load();
  };
  const toggle = async (b: Banner) => { await db.upsert('banners', [{ ...b, active: !b.active }]).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    await db.upsert('banners', [{ ...a, sort: j }, { ...b, sort: i }]).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    load();
  };
  const isLive = (b: Banner) => b.active && (!b.starts_at || new Date(b.starts_at) <= new Date()) && (!b.ends_at || new Date(b.ends_at) > new Date());

  return (
    <Shell title="Bannerlər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <span className="muted" style={{ flex: 1 }}>Ana səhifədəki slayder: endirim kampaniyaları, Visa/Mastercard aksiyaları, reklam. Sıra ilə göstərilir, 5 saniyədən bir yavaş sürüşür.</span>
        <button className="btn" onClick={() => setEdit({ ...EMPTY, sort: rows.length })}><Plus size={14} /> Yeni banner</button>
      </div>
      <table>
        <thead><tr><th>Sıra</th><th>Önizləmə</th><th>Başlıq</th><th>Link</th><th>Tarix</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((b, i) => (
            <tr key={b.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown size={14} /></button>
              </td>
              <td><Preview b={b} /></td>
              <td><b>{b.title}</b><div className="muted" style={{ fontSize: 12 }}>{b.subtitle}</div></td>
              <td className="muted" style={{ fontSize: 12 }}>{b.link ?? '—'}</td>
              <td className="muted" style={{ fontSize: 12 }}>{b.starts_at ? new Date(b.starts_at).toLocaleDateString('az-AZ') : '…'} → {b.ends_at ? new Date(b.ends_at).toLocaleDateString('az-AZ') : '…'}</td>
              <td><button className={`pill ${isLive(b) ? 'green' : 'gray'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(b)}>{isLive(b) ? 'canlı' : b.active ? 'tarixə görə gizli' : 'söndürülüb'}</button></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="btn ghost" onClick={() => setEdit(b)}>Düzəlt</button>
                <button className="btn ghost" onClick={() => remove(b)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 30 }}>Banner yoxdur. Banner olmayanda tətbiqdə slayder görünmür.</td></tr>}
        </tbody>
      </table>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.id ? 'Banneri düzəlt' : 'Yeni banner'}</h2>
              <button className="btn ghost" onClick={() => setEdit(null)}><X size={18} /></button>
            </div>
            <div style={{ margin: '14px 0' }}><Preview b={edit} large /></div>
            <div className="form-grid">
              <label className="full">Başlıq<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Visa ilə 10% endirim" /></label>
              <label className="full">Alt yazı<input value={edit.subtitle ?? ''} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} placeholder="Bravo-da 30 sentyabra qədər" /></label>
              <label className="full">Şəkil URL (istəyə görə, 1200×500 tövsiyə olunur)<input value={edit.image_url ?? ''} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} placeholder="https://…/banner.jpg" /></label>
              <label>Fon rəngi<input type="color" value={edit.bg_color ?? '#E53935'} onChange={(e) => setEdit({ ...edit, bg_color: e.target.value })} /></label>
              <label>Yazı rəngi<input type="color" value={edit.text_color ?? '#FFFFFF'} onChange={(e) => setEdit({ ...edit, text_color: e.target.value })} /></label>
              <label className="full">Link (tətbiq səhifəsi: /deals, /plus, /product/ID və ya https://…)<input value={edit.link ?? ''} onChange={(e) => setEdit({ ...edit, link: e.target.value })} placeholder="/deals" /></label>
              <label>Başlama<input type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: fromLocal(e.target.value) })} /></label>
              <label>Bitmə<input type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: fromLocal(e.target.value) })} /></label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} style={{ width: 'auto' }} /> Aktiv</label>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => setEdit(null)}>Ləğv et</button>
              <button className="btn" disabled={!edit.title.trim() || busy} onClick={save}>{busy ? 'Saxlanılır…' : 'Saxla'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Preview({ b, large }: { b: Banner; large?: boolean }) {
  const h = large ? 150 : 56;
  return (
    <div style={{ width: large ? '100%' : 140, height: h, borderRadius: large ? 18 : 10, background: b.bg_color ?? '#E53935', color: b.text_color ?? '#fff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: large ? '0 22px' : '0 10px' }}>
      {b.image_url && <img src={b.image_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />}
      <div style={{ position: 'relative', textShadow: b.image_url ? '0 1px 6px #0008' : undefined }}>
        <div style={{ fontWeight: 800, fontSize: large ? 20 : 11, lineHeight: 1.15 }}>{b.title || 'Başlıq'}</div>
        {b.subtitle && <div style={{ fontSize: large ? 13 : 9, opacity: 0.9, marginTop: large ? 4 : 1 }}>{b.subtitle}</div>}
      </div>
    </div>
  );
}
