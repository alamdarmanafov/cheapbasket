'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Category, Product, db, slugify } from '@/lib/supabase';

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState({ name: '', emoji: '', en: '', tr: '', ru: '' });
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

  const save = async (c: Category, oldName?: string): Promise<boolean> => {
    const err = await db.upsert('categories', [{ ...c }], 'id').then(() => null, (e: Error) => e.message);
    if (!err && oldName && oldName !== c.name && counts[oldName]) {
      // rename: move products to the new name
      const prods = await db.select<Product>('products', { eq: { category: oldName }, fetchAll: true }).catch(() => [] as Product[]);
      const seen = new Set<string>();
      const uniq = prods.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      if (uniq.length) await db.upsert('products', uniq.map((p) => ({ ...p, category: c.name })), 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    }
    setMsg({ ok: !err, text: err ?? `${c.name} yadda saxlanıldı` });
    load();
    return !err;
  };
  const add = async () => {
    const name = draft.name.trim();
    if (!name) return;
    const id = slugify(name) || `cat-${Date.now()}`;
    // "Şirniyyat" and "Sirniyyat" fold to the same id once accents are
    // stripped; an id clash used to upsert quietly into the existing row
    // instead of creating a new one — "əlavə et" said "saved" and nothing
    // new showed up. A name clash hits the table's unique constraint the
    // same way. Catch both here with a clear reason instead of either.
    const dupe = rows.find((r) => r.id === id || r.name.trim().toLowerCase() === name.toLowerCase());
    if (dupe) {
      setMsg({ ok: false, text: `"${dupe.name}" artıq var — fərqli ad seç, ya da onu redaktə et.` });
      return;
    }
    const names = Object.fromEntries((['en', 'tr', 'ru'] as const).map((l) => [l, draft[l].trim()]).filter(([, v]) => v));
    const ok = await save({ id, name, emoji: draft.emoji.trim() || null, sort: rows.length, names });
    if (ok) setDraft({ name: '', emoji: '', en: '', tr: '', ru: '' });
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
        <input placeholder="Emoji" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} style={{ width: 80, flex: 'none' }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {/* Tərcümələr əlavə etmə anında da yazıla bilsin — sonra cədvəldə
            hər sətir üçün ayrıca doldurmaq məcburi deyil, istəyə görədir. */}
        <input placeholder="EN (Dairy)" value={draft.en} onChange={(e) => setDraft({ ...draft, en: e.target.value })} style={{ width: 130, flex: 'none' }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input placeholder="TR (Süt ürünleri)" value={draft.tr} onChange={(e) => setDraft({ ...draft, tr: e.target.value })} style={{ width: 130, flex: 'none' }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input placeholder="RU (Молочные)" value={draft.ru} onChange={(e) => setDraft({ ...draft, ru: e.target.value })} style={{ width: 130, flex: 'none' }} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn" disabled={!draft.name.trim()} onClick={add}><Plus size={14} /> Əlavə et</button>
      </div>
      <table>
        <thead><tr><th>Sıra</th><th>Emoji</th><th>Ad</th><th>EN</th><th>TR</th><th>RU</th><th>Məhsul sayı</th><th></th></tr></thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown size={14} /></button>
              </td>
              <td><input value={c.emoji ?? ''} placeholder="🛒" style={{ width: 56, textAlign: 'center' }} onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, emoji: e.target.value } : r)))} onBlur={() => save(rows.find((r) => r.id === c.id) ?? c)} /></td>
              <td><input value={c.name} style={{ width: 260, textAlign: 'left' }} onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, name: e.target.value } : r)))} onBlur={(e) => { const cur = rows.find((r) => r.id === c.id) ?? c; if (cur.name.trim() && cur.name !== c.name) save({ ...cur, name: cur.name.trim() }, c.name); else if (cur.name.trim() !== e.target.value) save(cur); }} /></td>
              {(['en', 'tr', 'ru'] as const).map((l) => (
                <td key={l}>
                  <input
                    value={c.names?.[l] ?? ''}
                    placeholder={l === 'en' ? 'Dairy' : l === 'tr' ? 'Süt ürünleri' : 'Молочные'}
                    style={{ width: 130, textAlign: 'left' }}
                    onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, names: { ...(r.names ?? {}), [l]: e.target.value } } : r)))}
                    onBlur={() => {
                      const cur = rows.find((r) => r.id === c.id) ?? c;
                      const names = Object.fromEntries(Object.entries(cur.names ?? {}).map(([k, v]) => [k, (v ?? '').trim()]).filter(([, v]) => v));
                      if (JSON.stringify(names) !== JSON.stringify(Object.fromEntries(Object.entries(c.names ?? {}).filter(([, v]) => v)))) save({ ...cur, names });
                    }}
                  />
                </td>
              ))}
              <td className="muted">{counts[c.name] ?? 0}</td>
              <td style={{ textAlign: 'right' }}><button className="btn ghost" onClick={() => remove(c)}><Trash2 size={14} /></button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 30 }}>Kateqoriya yoxdur. Yuxarıdan əlavə et və ya "Wolt-dan import" səhifəsində "Kateqoriyaları götür" düyməsini bas.</td></tr>}
        </tbody>
      </table>
      <p className="note">Tətbiqdə ana səhifə və axtarışdakı kateqoriya çipləri bu sıra ilə göstərilir (yalnız məhsulu olan kateqoriyalar). Adı dəyişəndə həmin kateqoriyadakı məhsullar avtomatik yeni ada keçir. EN/TR/RU sütunları tətbiqi o dildə oxuyana göstərilən addır; boş qalsa tətbiqdəki daxili cədvəl, o da yoxdursa Azərbaycan adı görünür.</p>
    </Shell>
  );
}
