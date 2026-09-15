'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Category, Product, db, slugify } from '@/lib/supabase';

export default function Categories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState({ name: '', emoji: '', en: '', tr: '', ru: '' });
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // The name each row had in the database as of the last load/save, kept
  // outside React state so it survives every keystroke without re-render
  // churn. `save()` needs this to know whether a name actually *changed*
  // (and so whether products need moving to the new name) — `rows` alone
  // can't answer that once the input has already been typed into, because
  // by then the state holds the new text too.
  const savedNames = useRef<Record<string, string>>({});

  // Split so an edit's own save doesn't have to re-download every product
  // just to redraw a count that didn't change. Blurring one field used to
  // re-fetch the whole `products` table (paged, but still a lot once the
  // catalogue is a few thousand rows) before the row could re-render —
  // slow, and one flaky page of that fetch turned an emoji edit into
  // "Failed to fetch" at the top of the screen.
  const loadCategories = async (): Promise<Category[]> => {
    const c = await db.select<Category>('categories', { order: 'sort' }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [] as Category[]; });
    setRows(c);
    savedNames.current = Object.fromEntries(c.map((x) => [x.id, x.name]));
    return c;
  };
  const loadCounts = async () => {
    const p = await db.select<Product>('products', { columns: 'id, category', fetchAll: true }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [] as Product[]; });
    const n: Record<string, number> = {};
    p.forEach((x) => { n[x.category] = (n[x.category] ?? 0) + 1; });
    setCounts(n);
  };
  useEffect(() => {
    loadCategories();
    loadCounts();
  }, []);

  const save = async (c: Category, oldName?: string): Promise<boolean> => {
    const err = await db.upsert('categories', [{ ...c }], 'id').then(() => null, (e: Error) => e.message);
    let movedProducts = false;
    if (!err && oldName && oldName !== c.name && counts[oldName]) {
      // rename: move products to the new name
      movedProducts = true;
      const prods = await db.select<Product>('products', { eq: { category: oldName }, fetchAll: true }).catch(() => [] as Product[]);
      const seen = new Set<string>();
      const uniq = prods.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
      if (uniq.length) await db.upsert('products', uniq.map((p) => ({ ...p, category: c.name })), 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    }
    setMsg({ ok: !err, text: err ?? `${c.name} yadda saxlanıldı` });
    await loadCategories();
    // Only a rename touches how many products sit under which name — every
    // other edit (emoji, a translation, reordering) leaves counts exactly
    // as they were, so there is nothing here worth re-fetching the whole
    // products table for.
    if (movedProducts) await loadCounts();
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
    loadCategories();
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    await db.upsert('categories', [{ ...rows[i], sort: j }, { ...rows[j], sort: i }], 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    loadCategories();
  };

  // Imports (Halalzur, CSV, Wolt) write whatever string sat in the source
  // data straight into `products.category` — that string only shows up as a
  // real category (with an emoji, a place in the app's chip row) once a
  // `categories` row with the same name exists. Anything in `counts` that
  // has no matching row here is one of those orphaned strings; surface them
  // so they can be promoted to a real category or folded into one that
  // already covers the same thing, instead of only being visible as an
  // uncategorised product count.
  const unmatched = useMemo(() => {
    const known = new Set(rows.map((r) => r.name));
    return Object.entries(counts)
      .filter(([name, n]) => n > 0 && !known.has(name))
      .sort((a, b) => b[1] - a[1]);
  }, [rows, counts]);

  const promoteUnmatched = async (name: string) => {
    const id = slugify(name) || `cat-${Date.now()}`;
    if (rows.some((r) => r.id === id)) {
      setMsg({ ok: false, text: `"${name}" adına bənzər id artıq var — adını dəyişib yenidən yarat.` });
      return;
    }
    setBusy(name);
    await save({ id, name, emoji: null, sort: rows.length, names: {} });
    setBusy(null);
  };

  const mergeUnmatched = async (fromName: string) => {
    const toName = mergeTarget[fromName];
    if (!toName) return;
    if (!confirm(`"${fromName}" (${counts[fromName] ?? 0} məhsul) → "${toName}" kateqoriyasına köçürülsün?`)) return;
    setBusy(fromName);
    const prods = await db.select<Product>('products', { eq: { category: fromName }, fetchAll: true }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [] as Product[]; });
    if (prods.length) {
      await db.upsert('products', prods.map((p) => ({ ...p, category: toName })), 'id').catch((e: Error) => setMsg({ ok: false, text: e.message }));
    }
    setMsg({ ok: true, text: `${prods.length} məhsul "${toName}" kateqoriyasına köçürüldü` });
    await loadCounts();
    setBusy(null);
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
      {unmatched.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 600, marginTop: 0 }}>Uyğunsuz kateqoriyalar ({unmatched.length})</p>
          <p className="note" style={{ marginTop: 0 }}>
            İmportdan (məs. Halalzur) gələn məhsullarda bu adlar var, amma yuxarıdakı siyahıda yoxdur — ona görə tətbiqdə çip/emoji görünmür. Hər birini ya yeni kateqoriya kimi əlavə et, ya da mövcud birinə köçür.
          </p>
          <table>
            <thead><tr><th>Ad</th><th>Məhsul sayı</th><th></th></tr></thead>
            <tbody>
              {unmatched.map(([name, n]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="muted">{n}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <select
                      value={mergeTarget[name] ?? ''}
                      onChange={(e) => setMergeTarget({ ...mergeTarget, [name]: e.target.value })}
                      style={{ marginRight: 8 }}
                    >
                      <option value="">Köçür...</option>
                      {rows.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                    </select>
                    <button className="btn ghost" disabled={!mergeTarget[name] || busy === name} onClick={() => mergeUnmatched(name)}>Köçür</button>
                    <button className="btn" disabled={busy === name} onClick={() => promoteUnmatched(name)} style={{ marginLeft: 8 }}>Kateqoriya kimi əlavə et</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
              <td>
                <input
                  value={c.name}
                  style={{ width: 260, textAlign: 'left' }}
                  onChange={(e) => setRows(rows.map((r) => (r.id === c.id ? { ...r, name: e.target.value } : r)))}
                  onBlur={() => {
                    // Always save on blur — the field's own live value is
                    // the only copy of "did this change" left by now, and
                    // `save()` itself already no-ops the product-move step
                    // when the trimmed name matches what was on file.
                    const cur = rows.find((r) => r.id === c.id) ?? c;
                    const name = cur.name.trim();
                    if (!name) return; // never write a blank name over a real one
                    save({ ...cur, name }, savedNames.current[c.id]);
                  }}
                />
              </td>
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
                      save({ ...cur, names });
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
