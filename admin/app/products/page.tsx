'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { CATEGORIES, PriceRow, Product, Store, db, slugify, useCategories } from '@/lib/supabase';

type Cell = { price: string; discount: string };
type PriceMap = Record<string, Record<string, Cell>>; // product → store → cell
const EMPTY_CELL: Cell = { price: '', discount: '' };
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fmt = (v: number | null) => (v == null ? '' : String(v));

const EMPTY: Product = { id: '', barcode: '', name: '', brand: '', size: '', category: CATEGORIES[0], emoji: '🛒', tint: '#F3F4F6', image_url: null, rating: null };

export default function Products() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [priceFilter, setPriceFilter] = useState<'' | 'none' | 'partial'>('');
  const [edit, setEdit] = useState<{ product: Product; cells: Record<string, Cell>; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { names: catNames } = useCategories();

  const load = async () => {
    const [s, p, pr] = await Promise.all([
      db.select<Store>('stores', { order: 'name' }),
      db.select<Product>('products', { order: 'name' }),
      db.select<PriceRow>('prices', { columns: 'product_id, store_id, price, discount_price, updated_at' }),
    ]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], [], []] as [Store[], Product[], PriceRow[]]; });
    setStores(s);
    setProducts(p);
    const map: PriceMap = {};
    pr.forEach((r) => {
      map[r.product_id] = map[r.product_id] ?? {};
      map[r.product_id][r.store_id] = { price: fmt(r.price), discount: fmt(r.discount_price) };
    });
    setPrices(map);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    const priced = (p: Product) => stores.filter((s) => num(prices[p.id]?.[s.id]?.price ?? '') != null).length;
    return products.filter(
      (p) =>
        (!cat || p.category === cat) &&
        (!n || `${p.brand} ${p.name} ${p.barcode ?? ''} ${p.category}`.toLowerCase().includes(n)) &&
        (!priceFilter || (priceFilter === 'none' ? priced(p) === 0 : priced(p) > 0 && priced(p) < stores.length)),
    );
  }, [products, q, cat, priceFilter, prices, stores]);

  const noPriceCount = useMemo(() => products.filter((p) => !stores.some((s) => num(prices[p.id]?.[s.id]?.price ?? '') != null)).length, [products, prices, stores]);

  const removeFiltered = async () => {
    if (!filtered.length) return;
    if (!confirm(`Filtrdəki ${filtered.length} məhsul silinsin? (Tətbiqdə onsuz da görünmürlər)`)) return;
    setBusy(true);
    let err: string | null = null;
    for (const p of filtered) await db.delete('products', { id: p.id }).catch((e: Error) => { err = e.message; });
    setBusy(false);
    setMsg({ ok: !err, text: err ?? `${filtered.length} məhsul silindi` });
    load();
  };

  const open = (p: Product) => {
    const cells: Record<string, Cell> = {};
    stores.forEach((s) => { cells[s.id] = { ...(prices[p.id]?.[s.id] ?? EMPTY_CELL) }; });
    setEdit({ product: { ...p }, cells, isNew: !p.id });
  };
  const setCell = (sid: string, patch: Partial<Cell>) => edit && setEdit({ ...edit, cells: { ...edit.cells, [sid]: { ...edit.cells[sid], ...patch } } });
  const setP = (patch: Partial<Product>) => edit && setEdit({ ...edit, product: { ...edit.product, ...patch } });

  const validate = (cells: Record<string, Cell>): string | null => {
    for (const s of stores) {
      const c = cells[s.id] ?? EMPTY_CELL;
      const p = num(c.price);
      const d = num(c.discount);
      if ((p != null && (Number.isNaN(p) || p <= 0)) || (d != null && (Number.isNaN(d) || d <= 0))) return `${s.name}: qiymət rəqəm olmalıdır`;
      if (p == null && d != null) return `${s.name}: endirim üçün əvvəlcə adi qiyməti yaz`;
      if (p != null && d != null && d >= p) return `${s.name}: endirimli qiymət adi qiymətdən kiçik olmalıdır`;
    }
    return null;
  };

  const save = async () => {
    if (!edit) return;
    const { product: p, cells } = edit;
    const bad = validate(cells);
    if (bad) { setMsg({ ok: false, text: bad }); return; }
    setBusy(true);
    const row = { ...p, id: p.id || slugify(`${p.brand} ${p.name} ${p.size}`), barcode: p.barcode?.trim() || null, rating: p.rating || null, image_url: p.image_url?.trim() || null };
    try {
      await db.upsert('products', [row]);
      const now = new Date().toISOString();
      const up: Record<string, unknown>[] = [];
      for (const s of stores) {
        const c = cells[s.id] ?? EMPTY_CELL;
        const before = prices[row.id]?.[s.id];
        const changed = !before ? c.price.trim() !== '' : before.price !== c.price || before.discount !== c.discount;
        if (!changed) continue;
        if (num(c.price) == null) { if (before) await db.delete('prices', { product_id: row.id, store_id: s.id }); }
        else up.push({ product_id: row.id, store_id: s.id, price: num(c.price), discount_price: num(c.discount), updated_at: now });
      }
      if (up.length) await db.upsert('prices', up, 'product_id,store_id');
      let alertNote = '';
      if (up.length) {
        const a = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: new Date(Date.now() - 2 * 60000).toISOString() }) }).then((r) => r.json()).catch(() => null);
        if (a?.users) alertNote = ` · ${a.users} istifadəçiyə qiymət düşüşü bildirişi getdi`;
      }
      setMsg({ ok: true, text: `${row.brand} ${row.name} yadda saxlanıldı${up.length ? ` · ${up.length} qiymət yeniləndi` : ''}${alertNote}` });
      setEdit(null);
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (p: Product) => {
    if (!confirm(`${p.brand} ${p.name} silinsin?`)) return;
    const error = await db.delete('products', { id: p.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !error, text: error ?? 'Silindi' });
    setEdit(null);
    load();
  };

  const cheapestStore = (pid: string): { store: Store; value: number } | null => {
    let best: { store: Store; value: number } | null = null;
    for (const s of stores) {
      const c = prices[pid]?.[s.id];
      const v = c ? num(c.discount) ?? num(c.price) : null;
      if (v != null && !Number.isNaN(v) && (!best || v < best.value)) best = { store: s, value: v };
    }
    return best;
  };

  return (
    <Shell title="Məhsullar və qiymətlər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <Search size={16} className="muted" />
        <input placeholder="Ad, brend, barkod…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Bütün kateqoriyalar</option>
          {catNames.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as '' | 'none' | 'partial')} title="Qiymət vəziyyəti">
          <option value="">Bütün məhsullar</option>
          <option value="none">Heç bir marketdə qiyməti yoxdur ({noPriceCount})</option>
          <option value="partial">Bəzi marketlərdə qiyməti yoxdur</option>
        </select>
        {priceFilter === 'none' && filtered.length > 0 && <button className="btn danger" disabled={busy} onClick={removeFiltered}><Trash2 size={14} /> Filtrdəkiləri sil ({filtered.length})</button>}
        <button className="btn" onClick={() => open({ ...EMPTY, category: catNames[0] ?? CATEGORIES[0] })}><Plus size={14} /> Yeni məhsul</button>
      </div>
      {stores.length === 0 && <div className="alert err">Əvvəlcə "Marketlər" səhifəsində ən azı bir market əlavə et.</div>}
      <table>
        <thead>
          <tr><th>Məhsul</th><th>Kateqoriya</th><th>Qiymətlər (market · qiymət)</th><th>Ən ucuz</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const best = cheapestStore(p.id);
            return (
              <tr key={p.id} onClick={() => open(p)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {p.image_url ? <img src={p.image_url} alt="" width={34} height={34} style={{ borderRadius: 8, objectFit: 'cover' }} /> : <span style={{ fontSize: 22, width: 34, textAlign: 'center' }}>{p.emoji}</span>}
                    <div>
                      <b>{p.brand}</b> {p.name} <span className="muted">{p.size}</span>
                      <div className="muted" style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.barcode ?? 'barkod yoxdur'}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{p.category}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stores.map((s) => {
                      const c = prices[p.id]?.[s.id];
                      const price = c ? num(c.price) : null;
                      const disc = c ? num(c.discount) : null;
                      if (price == null) return <span key={s.id} className="pill gray" style={{ opacity: 0.55 }} title={`${s.name}: mövcud deyil`}>{s.initial} —</span>;
                      return (
                        <span key={s.id} className={`pill ${disc != null ? 'green' : 'gray'}`} title={s.name}>
                          <span className="avatar" style={{ background: s.color, width: 16, height: 16, fontSize: 8, marginRight: 4, verticalAlign: 'middle' }}>{s.initial}</span>
                          {disc != null ? <><s style={{ opacity: 0.6, marginRight: 4 }}>{price.toFixed(2)}</s>{disc.toFixed(2)}</> : price.toFixed(2)}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td>{best ? <span><span className="avatar" style={{ background: best.store.color }}>{best.store.initial}</span><b>{best.value.toFixed(2)} ₼</b></span> : <span className="muted">—</span>}</td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn ghost" onClick={() => open(p)}>Düzəlt</button>
                  <button className="btn ghost" onClick={() => removeProduct(p)} title="Sil"><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 30 }}>Məhsul yoxdur — "Yeni məhsul" ilə və ya "Wolt-dan import" ilə əlavə et.</td></tr>}
        </tbody>
      </table>
      <p className="note">Məhsula klik et: bir pəncərədə məlumatları və hər market üçün adi / endirimli qiyməti yaz. Yaşıl çip endirimin olduğunu göstərir. Hər dəyişiklik qiymət tarixçəsinə avtomatik yazılır. <b>Heç bir marketdə qiyməti olmayan məhsul tətbiqdə görünmür</b>; digər marketlərin qiymətini "Avtomatik yeniləmə"də həmin marketin Wolt mənbəsi ilə doldur.</p>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" style={{ width: 'min(760px,100%)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.isNew ? 'Yeni məhsul' : `${edit.product.brand} ${edit.product.name}`}</h2>
              <button className="btn ghost" onClick={() => setEdit(null)}><X size={18} /></button>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <label>Brend<input value={edit.product.brand} onChange={(e) => setP({ brand: e.target.value })} placeholder="Sütaş" /></label>
              <label>Ad<input value={edit.product.name} onChange={(e) => setP({ name: e.target.value })} placeholder="Süd 3.5%" /></label>
              <label>Ölçü<input value={edit.product.size} onChange={(e) => setP({ size: e.target.value })} placeholder="1 L" /></label>
              <label>Kateqoriya<select value={edit.product.category} onChange={(e) => setP({ category: e.target.value })}>{[...new Set([...catNames, edit.product.category].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>Barkod (EAN-13)<input value={edit.product.barcode ?? ''} onChange={(e) => setP({ barcode: e.target.value })} placeholder="8690767010012" inputMode="numeric" /></label>
              <label>Emoji<input value={edit.product.emoji ?? ''} onChange={(e) => setP({ emoji: e.target.value })} placeholder="🥛" /></label>
              <label>Fon rəngi<input type="color" value={edit.product.tint ?? '#F3F4F6'} onChange={(e) => setP({ tint: e.target.value })} /></label>
              <label>Reytinq (0–5)<input type="number" step="0.1" min="0" max="5" value={edit.product.rating ?? ''} onChange={(e) => setP({ rating: e.target.value ? Number(e.target.value) : null })} /></label>
              <label className="full">Şəkil URL (istəyə görə)<input value={edit.product.image_url ?? ''} onChange={(e) => setP({ image_url: e.target.value })} placeholder="https://…/sud.png" /></label>
            </div>

            <h3 style={{ margin: '18px 0 8px' }}>Marketlərdə qiymət</h3>
            <table>
              <thead><tr><th>Market</th><th style={{ width: 130 }}>Adi qiymət ₼</th><th style={{ width: 130 }}>Endirimli ₼</th><th>Tətbiqdə görünəcək</th></tr></thead>
              <tbody>
                {stores.map((s) => {
                  const c = edit.cells[s.id] ?? EMPTY_CELL;
                  const p = num(c.price);
                  const d = num(c.discount);
                  return (
                    <tr key={s.id}>
                      <td><span className="avatar" style={{ background: s.color }}>{s.initial}</span>{s.name}</td>
                      <td><input inputMode="decimal" placeholder="—" value={c.price} onChange={(e) => setCell(s.id, { price: e.target.value })} style={{ width: '100%' }} /></td>
                      <td><input inputMode="decimal" placeholder="yoxdur" value={c.discount} onChange={(e) => setCell(s.id, { discount: e.target.value })} style={{ width: '100%', color: d != null ? '#16A34A' : undefined, fontWeight: d != null ? 600 : undefined }} /></td>
                      <td className="muted">
                        {p == null ? 'mövcud deyil' : d != null ? <><s>{p.toFixed(2)}</s> <b style={{ color: '#16A34A' }}>{d.toFixed(2)} ₼</b> <span className="pill green">−{Math.round(((p - d) / p) * 100)}%</span></> : `${p.toFixed(2)} ₼`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note">Adi qiymət boşdursa məhsul həmin marketdə "mövcud deyil" sayılır. Endirim bitəndə endirim sahəsini boşalt.</p>
            <div className="actions">
              {!edit.isNew && <button className="btn danger" onClick={() => removeProduct(edit.product)} style={{ marginRight: 'auto' }}><Trash2 size={14} /> Sil</button>}
              <button className="btn secondary" onClick={() => setEdit(null)}>Ləğv et</button>
              <button className="btn" disabled={busy || !edit.product.name || !edit.product.brand || !edit.product.size} onClick={save}>{busy ? 'Saxlanılır…' : 'Saxla'}</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
