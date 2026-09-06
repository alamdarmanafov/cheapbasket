'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Store, slugify, supabase } from '@/lib/supabase';

export default function Stores() {
  const [rows, setRows] = useState<Store[]>([]);
  const [draft, setDraft] = useState<Store>({ id: '', name: '', color: '#E53935', initial: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('stores').select('*').order('name');
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async (s: Store) => {
    const row = { ...s, id: s.id || slugify(s.name), initial: s.initial || s.name.slice(0, 2) };
    const { error } = await supabase.from('stores').upsert(row);
    setMsg(error ? error.message : `${row.name} yadda saxlanıldı`);
    if (!error) { setDraft({ id: '', name: '', color: '#E53935', initial: '' }); load(); }
  };
  const remove = async (s: Store) => {
    if (!confirm(`${s.name} silinsin? Bu marketin bütün qiymətləri və filialları da silinəcək.`)) return;
    const { error } = await supabase.from('stores').delete().eq('id', s.id);
    setMsg(error ? error.message : `${s.name} silindi`);
    load();
  };

  return (
    <Shell title="Marketlər">
      {msg && <div className="alert ok">{msg}</div>}
      <table>
        <thead><tr><th>ID</th><th>Ad</th><th>Rəng</th><th>Qısaltma</th><th></th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="muted">{s.id}</td>
              <td><input value={s.name} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, name: e.target.value } : r)))} style={{ width: 180, textAlign: 'left' }} /></td>
              <td><input type="color" value={s.color} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, color: e.target.value } : r)))} style={{ width: 48, padding: 2 }} /> <span className="avatar" style={{ background: s.color }}>{s.initial}</span></td>
              <td><input value={s.initial} maxLength={2} onChange={(e) => setRows(rows.map((r) => (r.id === s.id ? { ...r, initial: e.target.value } : r)))} style={{ width: 60, textAlign: 'left' }} /></td>
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
            <td style={{ textAlign: 'right' }}><button className="btn" disabled={!draft.name} onClick={() => save(draft)}><Plus size={14} /> Əlavə et</button></td>
          </tr>
        </tbody>
      </table>
      <p className="note">ID avtomatik yaranır və sonradan dəyişmir; tətbiq qiymətləri bu ID ilə bağlayır.</p>
    </Shell>
  );
}
