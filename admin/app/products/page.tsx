'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { CATEGORIES, PriceRow, Product, Store, slugify, supabase } from '@/lib/supabase';

const EMPTY: Product = { id: '', barcode: '', name: '', brand: '', size: '', category: CATEGORIES[0], emoji: '🛒', tint: '#F3F4F6', image_url: null, rating: null };

export default function Products() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Record<string, Record<string, string>>>({}); // product → store → price text
  const [saved, setSaved] = useState<Record<string, Record<string, string>>>({});
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Product | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: pr }] = await Promise.all([
      supabase.from('stores').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('prices').select('product_id, store_id, price, updated_at'),
    ]);
    setStores(s ?? []);
    setProducts(p ?? []);
    const map: Record<string, Record<string, string>> = {};
    (pr as PriceRow[] | null)?.forEach((r) => {
      map[r.product_id] = map[r.product_id] ?? {};
      map[r.product_id][r.store_id] = r.price == null ? '' : String(r.price);
    });
    setPrices(map);
    setSaved(JSON.parse(JSON.stringify(map)));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? products.filter((p) => `${p.brand} ${p.name} ${p.barcode ?? ''} ${p.category}`.toLowerCase().includes(n)) : products;
  }, [products, q]);

  const dirty = useMemo(() => {
    const out: { product_id: string; store_id: string; price: number | null }[] = [];
    for (const pid of Object.keys(prices)) for (const sid of Object.keys(prices[pid])) {
      const v = prices[pid][sid];
      if ((saved[pid]?.[sid] ?? '') !== v) out.push({ product_id: pid, store_id: sid, price: v.trim() === '' ? null : Number(v.replace(',', '.')) });
    }
    return out;
  }, [prices, saved]);

  const savePrices = async () => {
    setBusy(true);
    const toUpsert = dirty.filter((d) => d.price != null && !Number.isNaN(d.price));
    const toDelete = dirty.filter((d) => d.price == null);
    let err: string | null = null;
    if (toUpsert.length) {
      const { error } = await supabase.from('prices').upsert(toUpsert.map((d) => ({ ...d, updated_at: new Date().toISOString() })), { onConflict: 'product_id,store_id' });
      if (error) err = error.message;
    }
    for (const d of toDelete) {
      const { error } = await supabase.from('prices').delete().eq('product_id', d.product_id).eq('store_id', d.store_id);
      if (error) err = error.message;
    }
    setBusy(false);
    setMsg({ ok: !err, text: err ?? `${dirty.length} qiymət yeniləndi` });
    if (!err) load();
  };

  const saveProduct = async (p: Product) => {
    const row = { ...p, id: p.id || slugify(`${p.brand} ${p.name} ${p.size}`), barcode: p.barcode?.trim() || null, rating: p.rating || null, image_url: p.image_url?.trim() || null };
    const { error } = await supabase.from('products').upsert(row);
    setMsg({ ok: !error, text: error ? error.message : `${row.brand} ${row.name} yadda saxlanıldı` });
    if (!error) { setEdit(null); load(); }
  };
  const removeProduct = async (p: Product) => {
    if (!confirm(`${p.brand} ${p.name} silinsin?`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    setMsg({ ok: !error, text: error ? error.message : 'Silindi' });
    load();
  };

  return (
    <Shell title="Məhsullar və qiymətlər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <Search size={16} className="muted" />
        <input placeholder="Ad, brend, barkod, kateqoriya…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn secondary" onClick={() => setEdit({ ...EMPTY })}><Plus size={14} /> Yeni məhsul</button>
        <button className="btn" disabled={!dirty.length || busy} onClick={savePrices}>{busy ? 'Saxlanılır…' : `Qiymətləri saxla (${dirty.length})`}</button>
      </div>
      {stores.length === 0 && <div className="alert err">Əvvəlcə "Marketlər" səhifəsində ən azı bir market əlavə et.</div>}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Məhsul</th><th>Barkod</th><th>Kateqoriya</th>
              {stores.map((s) => <th key={s.id} style={{ textAlign: 'right' }}><span className="avatar" style={{ background: s.color }}>{s.initial}</span>{s.name} ₼</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><span style={{ fontSize: 18, marginRight: 6 }}>{p.emoji}</span><b>{p.brand}</b> {p.name} <span className="muted">{p.size}</span></td>
                <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.barcode ?? '—'}</td>
                <td className="muted">{p.category}</td>
                {stores.map((s) => (
                  <td key={s.id} style={{ textAlign: 'right' }}>
                    <input inputMode="decimal" placeholder="—" value={prices[p.id]?.[s.id] ?? ''} onChange={(e) => setPrices({ ...prices, [p.id]: { ...(prices[p.id] ?? {}), [s.id]: e.target.value } })}
                      style={{ borderColor: (saved[p.id]?.[s.id] ?? '') !== (prices[p.id]?.[s.id] ?? '') ? '#E53935' : undefined }} />
                  </td>
                ))}
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn ghost" onClick={() => setEdit(p)}>Düzəlt</button>
                  <button className="btn ghost" onClick={() => removeProduct(p)} title="Sil"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4 + stores.length} className="muted" style={{ textAlign: 'center', padding: 30 }}>Məhsul yoxdur — "Yeni məhsul" ilə əlavə et.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="note">Qiymət sahəsini boş buraxsan, məhsul həmin marketdə "mövcud deyil" sayılır. Hər dəyişiklik qiymət tarixçəsinə avtomatik yazılır.</p>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.id ? 'Məhsulu düzəlt' : 'Yeni məhsul'}</h2>
              <button className="btn ghost" onClick={() => setEdit(null)}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label>Brend<input value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} placeholder="Sütaş" /></label>
              <label>Ad<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Süd 3.5%" /></label>
              <label>Ölçü<input value={edit.size} onChange={(e) => setEdit({ ...edit, size: e.target.value })} placeholder="1 L" /></label>
              <label>Kateqoriya<select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Barkod (EAN-13)<input value={edit.barcode ?? ''} onChange={(e) => setEdit({ ...edit, barcode: e.target.value })} placeholder="8690767010012" inputMode="numeric" /></label>
              <label>Emoji<input value={edit.emoji ?? ''} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} placeholder="🥛" /></label>
              <label>Fon rəngi<input type="color" value={edit.tint ?? '#F3F4F6'} onChange={(e) => setEdit({ ...edit, tint: e.target.value })} /></label>
              <label>Reytinq (0–5)<input type="number" step="0.1" min="0" max="5" value={edit.rating ?? ''} onChange={(e) => setEdit({ ...edit, rating: e.target.value ? Number(e.target.value) : null })} /></label>
              <label className="full">Şəkil URL (istəyə görə)<input value={edit.image_url ?? ''} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} placeholder="https://…/sud.png" /></label>
            </div>
            <p className="note">ID: <code>{edit.id || slugify(`${edit.brand} ${edit.name} ${edit.size}`) || '—'}</code></p>
            <div className="actions">
              <button className="btn secondary" onClick={() => setEdit(null)}>Ləğv et</button>
              <button className="btn" disabled={!edit.name || !edit.brand || !edit.size} onClick={() => saveProduct(edit)}>Saxla</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
