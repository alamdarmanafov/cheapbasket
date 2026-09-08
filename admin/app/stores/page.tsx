'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Store, db, slugify } from '@/lib/supabase';

export default function Stores() {
  const [rows, setRows] = useState<Store[]>([]);
  const [draft, setDraft] = useState<Store>({ id: '', name: '', color: '#E53935', initial: '', logo_url: '', open_from: '', open_until: '', always_open: false });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setRows(await db.select<Store>('stores', { order: 'name' }).catch((e: Error) => { setMsg(`Yükləmə xətası: ${e.message}`); return []; }));
  };
  useEffect(() => { load(); }, []);

  const save = async (s: Store) => {
    const row = { ...s, id: s.id || slugify(s.name), initial: s.initial || s.name.slice(0, 2) };
    const error = await db.upsert('stores', [row]).then(() => null, (e: Error) => e.message);
    setMsg(error ?? `${row.name} yadda saxlanıldı`);
    if (!error) { setDraft({ id: '', name: '', color: '#E53935', initial: '', logo_url: '', open_from: '', open_until: '', always_open: false }); load(); }
  };
  const remove = async (s: Store) => {
    if (!confirm(`${s.name} silinsin? Bu marketin bütün qiymətləri və filialları da silinəcək.`)) return;
    const error = await db.delete('stores', { id: s.id }).then(() => null, (e: Error) => e.message);
    setMsg(error ?? `${s.name} silindi`);
    load();
  };

  return (
    <Shell title="Marketlər">
      {msg && <div className={`alert ${msg.startsWith('Yükləmə xətası') || msg.includes('error') ? 'err' : 'ok'}`}>{msg}</div>}
      <table>
        <thead><tr><th>ID</th><th>Ad</th><th>Rəng</th><th>Qısaltma</th><th>Logo URL</th><th>İş saatı</th><th></th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="muted">{s.id}</td>
              <td><input value={s.name} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, name: e.target.value } : r)))} style={{ width: 180, textAlign: 'left' }} /></td>
              <td><input type="color" value={s.color} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, color: e.target.value } : r)))} style={{ width: 48, padding: 2 }} /> <span className="avatar" style={{ background: s.color }}>{s.initial}</span></td>
              <td><input value={s.initial} maxLength={2} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, initial: e.target.value } : r)))} style={{ width: 60, textAlign: 'left' }} /></td>
              <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  placeholder="https://…"
                  value={s.logo_url ?? ''}
                  onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, logo_url: e.target.value || null } : r)))}
                  style={{ width: 220, textAlign: 'left' }}
                />
                {s.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, border: '1px solid #eee' }} />
                )}
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <Hours
                  value={s}
                  onChange={(patch) => setRows(rows.map((r) => (r.id === s.id ? { ...r, ...patch } : r)))}
                />
              </td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn secondary" onClick={() => save(s)}>Saxla</button>{' '}
                <button className="btn danger" onClick={() => remove(s)} title="Sil"><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="muted">{draft.id || slugify(draft.name) || 'avtomatik'}</td>
            <td><input placeholder="Yeni market adı" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: 180, textAlign: 'left' }} /></td>
            <td><input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 48, padding: 2 }} /></td>
            <td><input placeholder="A" maxLength={2} value={draft.initial} onChange={(e) => setDraft({ ...draft, initial: e.target.value })} style={{ width: 60, textAlign: 'left' }} /></td>
            <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                placeholder="https://…"
                value={draft.logo_url ?? ''}
                onChange={(e) => setDraft({ ...draft, logo_url: e.target.value || null })}
                style={{ width: 220, textAlign: 'left' }}
              />
              {draft.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logo_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 4, border: '1px solid #eee' }} />
              )}
            </td>
            <td style={{ whiteSpace: 'nowrap' }}>
              <Hours value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} />
            </td>
            <td style={{ textAlign: 'right' }}><button className="btn" disabled={!draft.name} onClick={() => save(draft)}><Plus size={14} /> Əlavə et</button></td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        ID avtomatik yaranır və sonradan dəyişmir; tətbiq qiymətləri bu ID ilə bağlayır.
        İş saatı bütün şəbəkə üçün bir dəfə yazılır — filiallar onu miras alır, sonradan əlavə olunanlar da daxil.
        Ayrıca bir filialın saatı fərqlidirsə, onu Filiallar səhifəsində həmin filiala yazmaq kifayətdir.
      </p>
    </Shell>
  );
}

/** Store-level opening hours: one row of inputs, or a single "24 saat" switch. */
function Hours({ value, onChange }: { value: Store; onChange: (patch: Partial<Store>) => void }) {
  const always = !!value.always_open;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        value={value.open_from ?? ''}
        onChange={(e) => onChange({ open_from: e.target.value })}
        placeholder="08:00"
        disabled={always}
        style={{ width: 68, textAlign: 'center' }}
      />
      <span className="muted">–</span>
      <input
        value={value.open_until ?? ''}
        onChange={(e) => onChange({ open_until: e.target.value })}
        placeholder="23:00"
        disabled={always}
        style={{ width: 68, textAlign: 'center' }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
        <input type="checkbox" checked={always} onChange={(e) => onChange({ always_open: e.target.checked })} style={{ width: 'auto' }} />
        24 saat
      </label>
    </div>
  );
}
