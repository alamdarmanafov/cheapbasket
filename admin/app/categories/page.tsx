'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Category, Product, db, slugify } from '@/lib/supabase';

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState({ name: '', emoji: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const [c, p] = await Promise.all([
      db.select<Category>('categories', { order: 'sort' }),
      db.select<Product>('products', { columns: 'id, category', fetchAll: true }),
    ]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], []] as [Category[], Product[]]; });
    setRows(c);
    const n: Record<string, number> = {};
    p.forEach((x) => { n[x.category] = (n[x.category] ?? 0) + 1; });
    setCounts(n);
  };
  useEffect(() => { load(); }, []);

  const save = async (c: Category, oldName?: string) => {
    const err = await db.upsert('categories', [{ ...c }], 'id').then(() => null, (e: Error) => e.message);
    if (!err && oldName && oldName !== c.name && counts[oldName]) {
      // rename: move products to the new name
      const prods = await db.select<Product>('products', { eq: { category: oldName } }).catch(() => [] as Product[]);
      const seen = new Set<string>();
      const uniq = prods.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      if (uniq.length) await db.upsert('products', uniq.map((p) => ({ ...p, category: c.name })), 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    }
    setMsg({ ok: !err, text: err ?? `${c.name} yadda saxlanıldı` });
    load();
  };
  const add = async () => {
    const name = draft.name.trim();
    if (!name) return;
    await save({ id: slugify(name) || `cat-${Date.now()}`, name, emoji: draft.emoji.trim() || null, sort: rows.length });
    setDraft({ name: '', emoji: '' });
  };
  const remove = async (c: Category) => {
    const n = counts[c.name] ?? 0;
    if (!confirm(n ? `${c.name} silinsin? ${n} məhsul bu kateqoriyada qalır (adı dəyişmir), sonra "Məhsullar"da dəyişərsən.` : `${c.name} silinsin?`)) return;
    const err = await db.delete('categories', { id: c.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !err, text: err ?? 'Silindi' });
    load();
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    await db.upsert('categories', [{ ...rows[i], sort: j }, { ...rows[j], sort: i }], 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    load();
  };

  return (
    <Shell title="Kateqoriyalar">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <input placeholder="Yeni kateqoriya adı" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input placeholder="Emoji" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} style={{ width: 80, flex: 'none' }} />
        <button className="btn" disabled={!draft.name.trim()} onClick={add}><Plus size={14} /> Əlavə et</button>
      </div>
      <table>
        <thead><tr><th>Sıra</th><th>Emoji</th><th>Ad</th><th>Məhsul sayı</th><th></th></tr></thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown size={14} /></button>
              </td>
              <td><input value={c.emoji ?? ''} placeholder="🛒" style={{ width: 56, textAlign: 'center' }} onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, emoji: e.target.value } : r)))} onBlur={() => save(rows.find((r) => r.id === c.id) ?? c)} /></td>
              <td><input value={c.name} style={{ width: 260, textAlign: 'left' }} onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, name: e.target.value } : r)))} onBlur={(e) => { const cur = rows.find((r) => r.id === c.id) ?? c; if (cur.name.trim() && cur.name !== c.name) save({ ...cur, name: cur.name.trim() }, c.name); else if (cur.name.trim() !== e.target.value) save(cur); }} /></td>
              <td className="muted">{counts[c.name] ?? 0}</td>
              <td style={{ textAlign: 'right' }}><button className="btn ghost" onClick={() => remove(c)}><Trash2 size={14} /></button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>Kateqoriya yoxdur. Yuxarıdan əlavə et və ya "Wolt-dan import" səhifəsində "Kateqoriyaları götür" düyməsini bas.</td></tr>}
        </tbody>
      </table>
      <p className="note">Tətbiqdə ana səhifə və axtarışdakı kateqoriya çipləri bu sıra ilə göstərilir (yalnız məhsulu olan kateqoriyalar). Adı dəyişəndə həmin kateqoriyadakı məhsullar avtomatik yeni ada keçir.</p>
    </Shell>
  );
}
