'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Camera, ChevronLeft, ChevronRight, Copy, Download, Plus, Search, Trash2, X } from 'lucide-react';

const PAGE_SIZE = 50;
import * as XLSX from 'xlsx';
import { Shell } from '@/components/Shell';
import { CATEGORIES, PriceRow, Product, Store, db, slugify, useCategories } from '@/lib/supabase';

type Cell = { price: string; discount: string };
type PriceMap = Record<string, Record<string, Cell>>; // product → store → cell
const EMPTY_CELL: Cell = { price: '', discount: '' };
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fmt = (v: number | null) => (v == null ? '' : String(v));

const EMPTY: Product = { id: '', barcode: '', name: '', brand: '', size: '', category: CATEGORIES[0], emoji: '🛒', tint: '#F3F4F6', image_url: null, rating: null };

// ── Duplicate detection ───────────────────────────────────────────────────────
type DupGroup = { key: string; kind: 'barcode' | 'name'; products: Product[] };

const normSlug = (s: string) =>
  s.toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .split(/\s+/).sort().join(' ');

function findDuplicates(products: Product[]): DupGroup[] {
  const groups: DupGroup[] = [];

  // By barcode
  const byBarcode = new Map<string, Product[]>();
  for (const p of products) {
    if (p.barcode) {
      const arr = byBarcode.get(p.barcode) ?? [];
      arr.push(p);
      byBarcode.set(p.barcode, arr);
    }
  }
  for (const [bc, ps] of byBarcode) {
    if (ps.length > 1) groups.push({ key: `Barkod: ${bc}`, kind: 'barcode', products: ps });
  }

  // By normalised name (excluding ones already caught by barcode)
  const barcodeProductIds = new Set(groups.flatMap((g) => g.products.map((p) => p.id)));
  const byName = new Map<string, Product[]>();
  for (const p of products) {
    if (barcodeProductIds.has(p.id)) continue;
    const key = normSlug(`${p.brand} ${p.name} ${p.size}`);
    const arr = byName.get(key) ?? [];
    arr.push(p);
    byName.set(key, arr);
  }
  for (const [key, ps] of byName) {
    if (ps.length > 1) groups.push({ key: `Ad: ${key}`, kind: 'name', products: ps });
  }

  return groups;
}

// ── Image preview modal ───────────────────────────────────────────────────────
type ImagePreview = { productId: string; image_url: string; item_name: string; venue: string } | null;

export default function Products() {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceMap>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [brand, setBrand] = useState('');
  const [store, setStore] = useState('');
  const [storeMode, setStoreMode] = useState<'has' | 'missing'>('has');
  const [priceFilter, setPriceFilter] = useState<'' | 'none' | 'partial'>('');
  const [noImageFilter, setNoImageFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<{ product: Product; cells: Record<string, Cell>; isNew: boolean } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { names: catNames } = useCategories();

  // Bulk edit state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState('');
  const [bulkEmoji, setBulkEmoji] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  // Duplicate detection state
  const [dupGroups, setDupGroups] = useState<DupGroup[] | null>(null);
  const [dupBusy, setDupBusy] = useState(false);
  const [dupKeep, setDupKeep] = useState<Record<string, string>>({}); // groupKey → product id to keep
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set()); // selected group keys for bulk merge
  const [dupMerging, setDupMerging] = useState(false);
  const [dupProgress, setDupProgress] = useState<{ done: number; total: number } | null>(null);

  // Image fetch state
  const [imageFetch, setImageFetch] = useState<Record<string, 'loading' | 'error'>>({});
  const [imagePreview, setImagePreview] = useState<ImagePreview>(null);

  /**
   * Writes the currently filtered products to Excel: identity columns, then one
   * price column per store. The sheet mirrors the import format, so an exported
   * file can be corrected and uploaded straight back.
   */
  const exportXlsx = () => {
    const header = ['Barkod', 'Brend', 'Ad', 'Ölçü', 'Kateqoriya', ...stores.map((s2) => s2.name)];
    const body = filtered.map((p) => [
      p.barcode ?? '',
      p.brand,
      p.name,
      p.size,
      p.category,
      ...stores.map((s2) => {
        const cell = prices[p.id]?.[s2.id];
        // The discounted price is what a shopper pays, so it wins when set.
        const v = cell?.discount || cell?.price || '';
        return v === '' ? '' : Number(v);
      }),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws['!cols'] = header.map((h, i) => ({ wch: i < 5 ? Math.max(12, h.length + 4) : 11 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');
    XLSX.writeFile(wb, `mehsullar-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const load = async () => {
    const [s, p, pr] = await Promise.all([
      db.select<Store>('stores', { order: 'name' }),
      db.select<Product>('products', { order: 'name', fetchAll: true }),
      db.select<PriceRow>('prices', { columns: 'product_id, store_id, price, discount_price, updated_at', fetchAll: true }),
    ]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], [], []] as [Store[], Product[], PriceRow[]]; });
    setStores(s);
    setProducts(p);
    const map: PriceMap = {};
    pr.forEach((r) => {
      map[r.product_id] = map[r.product_id] ?? {};
      map[r.product_id][r.store_id] = { price: fmt(r.price), discount: fmt(r.discount_price) };
    });
    setPrices(map);
    setSelected(new Set());
  };
  useEffect(() => { load(); }, []);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(), [products]);

  const hasPriceAt = useCallback((pid: string, sid: string) => num(prices[pid]?.[sid]?.price ?? '') != null, [prices]);

  /** How many products each store carries — shown in the store filter. */
  const storeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stores) m[s.id] = products.filter((p) => hasPriceAt(p.id, s.id)).length;
    return m;
  }, [products, stores, hasPriceAt]);

  const filtered = useMemo(() => {
    setPage(1);
    const n = q.trim().toLowerCase();
    const priced = (p: Product) => stores.filter((s) => hasPriceAt(p.id, s.id)).length;
    return products.filter(
      (p) =>
        (!cat || p.category === cat) &&
        (!brand || p.brand === brand) &&
        (!store || (storeMode === 'has' ? hasPriceAt(p.id, store) : !hasPriceAt(p.id, store))) &&
        (!n || `${p.brand} ${p.name} ${p.barcode ?? ''} ${p.category} ${p.size}`.toLowerCase().includes(n)) &&
        (!priceFilter || (priceFilter === 'none' ? priced(p) === 0 : priced(p) > 0 && priced(p) < stores.length)) &&
        (!noImageFilter || !p.image_url),
    );
  }, [products, q, cat, brand, store, storeMode, priceFilter, noImageFilter, stores, hasPriceAt]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const noPriceCount = useMemo(() => products.filter((p) => !stores.some((s) => num(prices[p.id]?.[s.id]?.price ?? '') != null)).length, [products, prices, stores]);
  const noImageCount = useMemo(() => products.filter((p) => !p.image_url).length, [products]);

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

  // ── Bulk edit helpers ────────────────────────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((p) => next.delete(p.id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); filtered.forEach((p) => next.add(p.id)); return next; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const bulkApplyCategory = async () => {
    if (!bulkCat || !selected.size) return;
    setBulkBusy(true);
    const rows = [...selected]
      .map((id) => products.find((x) => x.id === id))
      .filter((p): p is Product => p !== undefined)
      .map((p) => ({ ...p, category: bulkCat }));
    try {
      await db.upsert('products', rows as unknown as Record<string, unknown>[], 'id');
      setMsg({ ok: true, text: `${rows.length} məhsulun kateqoriyası dəyişdirildi` });
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBulkBusy(false); }
  };

  const bulkApplyEmoji = async () => {
    if (!bulkEmoji || !selected.size) return;
    setBulkBusy(true);
    const rows = [...selected]
      .map((id) => products.find((x) => x.id === id))
      .filter((p): p is Product => p !== undefined)
      .map((p) => ({ ...p, emoji: bulkEmoji }));
    try {
      await db.upsert('products', rows as unknown as Record<string, unknown>[], 'id');
      setMsg({ ok: true, text: `${rows.length} məhsulun emojisi dəyişdirildi` });
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBulkBusy(false); }
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    if (!confirm(`${selected.size} seçilmiş məhsul silinsin?`)) return;
    setBulkBusy(true);
    let err: string | null = null;
    for (const id of selected) await db.delete('products', { id }).catch((e: Error) => { err = e.message; });
    setBulkBusy(false);
    setMsg({ ok: !err, text: err ?? `${selected.size} məhsul silindi` });
    setSelected(new Set());
    load();
  };

  const bulkFetchImages = async () => {
    if (!selected.size) return;
    const noImage = [...selected].map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p && !p.image_url);
    if (!noImage.length) { setMsg({ ok: false, text: 'Seçilmiş məhsulların hamısında şəkil var' }); return; }
    setMsg({ ok: true, text: `${noImage.length} məhsul üçün şəkil axtarılır…` });
    let found = 0;
    for (const p of noImage) {
      setImageFetch((prev) => ({ ...prev, [p.id]: 'loading' }));
      try {
        const r = await fetch(`/api/products/image?q=${encodeURIComponent(`${p.brand} ${p.name} ${p.size}`)}`).then((x) => x.json());
        if (r.image_url) {
          await db.upsert('products', [{ ...p, image_url: r.image_url }], 'id');
          found++;
          setImageFetch((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
        } else {
          setImageFetch((prev) => ({ ...prev, [p.id]: 'error' }));
        }
      } catch {
        setImageFetch((prev) => ({ ...prev, [p.id]: 'error' }));
      }
    }
    setMsg({ ok: true, text: `${found}/${noImage.length} məhsul üçün şəkil tapıldı` });
    load();
  };

  // ── Duplicate detection ──────────────────────────────────────────────────────
  const findDups = useCallback(async () => {
    setDupBusy(true);
    try {
      const all = await db.select<Product>('products', { columns: 'id,barcode,name,brand,size,category,image_url', fetchAll: true });
      const groups = findDuplicates(all);
      setDupGroups(groups);
      // Default: keep first in each group
      const defaults: Record<string, string> = {};
      for (const g of groups) defaults[g.key] = g.products[0].id;
      setDupKeep(defaults);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setDupBusy(false); }
  }, []);

  const mergeDupGroup = async (group: DupGroup) => {
    const keepId = dupKeep[group.key];
    if (!keepId) return;
    const toDelete = group.products.filter((p) => p.id !== keepId);
    if (!confirm(`"${group.key}" qrupunda ${toDelete.length} dublikat silinsin?`)) return;
    setBusy(true);
    try {
      for (const p of toDelete) {
        const pPrices = await db.select<PriceRow>('prices', { eq: { product_id: p.id }, columns: 'product_id,store_id,price,discount_price,updated_at' });
        if (pPrices.length) {
          const moved = pPrices.map((r) => ({ ...r, product_id: keepId }));
          await db.upsert('prices', moved as unknown as Record<string, unknown>[], 'product_id,store_id');
        }
        await db.delete('products', { id: p.id });
      }
      setMsg({ ok: true, text: `${toDelete.length} dublikat silindi, qiymətlər birləşdirildi` });
      const all = await db.select<Product>('products', { columns: 'id,barcode,name,brand,size,category,image_url', fetchAll: true });
      const groups = findDuplicates(all);
      setDupGroups(groups);
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  const mergeDupGroupSilent = async (group: DupGroup): Promise<{ merged: number; error?: string }> => {
    const keepId = dupKeep[group.key];
    if (!keepId) return { merged: 0 };
    const toDelete = group.products.filter((p) => p.id !== keepId);
    try {
      for (const p of toDelete) {
        const pPrices = await db.select<PriceRow>('prices', { eq: { product_id: p.id }, columns: 'product_id,store_id,price,discount_price,updated_at' });
        if (pPrices.length) {
          const moved = pPrices.map((r) => ({ ...r, product_id: keepId }));
          await db.upsert('prices', moved as unknown as Record<string, unknown>[], 'product_id,store_id');
        }
        await db.delete('products', { id: p.id });
      }
      return { merged: toDelete.length };
    } catch (e) { return { merged: 0, error: (e as Error).message }; }
  };

  const mergeBulkDups = async (groups: DupGroup[]) => {
    if (!groups.length) return;
    const totalDups = groups.reduce((acc, g) => acc + g.products.length - 1, 0);
    if (!confirm(`${groups.length} qrupda ${totalDups} dublikat silinsin?`)) return;
    setDupMerging(true);
    setDupProgress({ done: 0, total: groups.length });
    let totalMerged = 0;
    const errors: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      const { merged, error } = await mergeDupGroupSilent(groups[i]);
      totalMerged += merged;
      if (error) errors.push(error);
      setDupProgress({ done: i + 1, total: groups.length });
    }
    const all = await db.select<Product>('products', { columns: 'id,barcode,name,brand,size,category,image_url', fetchAll: true });
    const newGroups = findDuplicates(all);
    setDupGroups(newGroups);
    const defaults: Record<string, string> = { ...dupKeep };
    for (const g of newGroups) if (!defaults[g.key]) defaults[g.key] = g.products[0].id;
    setDupKeep(defaults);
    setDupSelected(new Set());
    setDupMerging(false);
    setDupProgress(null);
    setMsg({ ok: !errors.length, text: errors.length ? `${totalMerged} silindi, xəta: ${errors[0]}` : `${totalMerged} dublikat silindi, qiymətlər birləşdirildi` });
    load();
  };

  // ── Auto image fetch ─────────────────────────────────────────────────────────
  const fetchImage = async (p: Product) => {
    setImageFetch((prev) => ({ ...prev, [p.id]: 'loading' }));
    try {
      const r = await fetch(`/api/products/image?q=${encodeURIComponent(`${p.brand} ${p.name} ${p.size}`)}`).then((x) => x.json());
      if (r.image_url) {
        setImagePreview({ productId: p.id, image_url: r.image_url, item_name: r.item_name ?? '', venue: r.venue ?? '' });
        setImageFetch((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
      } else {
        setImageFetch((prev) => ({ ...prev, [p.id]: 'error' }));
      }
    } catch {
      setImageFetch((prev) => ({ ...prev, [p.id]: 'error' }));
    }
  };

  const saveImagePreview = async () => {
    if (!imagePreview) return;
    const p = products.find((x) => x.id === imagePreview.productId);
    if (!p) return;
    setBusy(true);
    try {
      await db.upsert('products', [{ ...p, image_url: imagePreview.image_url }], 'id');
      setMsg({ ok: true, text: 'Şəkil saxlanıldı' });
      setImagePreview(null);
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <Shell title="Məhsullar və qiymətlər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* ── Main toolbar ── */}
      <div className="toolbar">
        <Search size={16} className="muted" />
        <input placeholder="Ad, brend, barkod…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Bütün brendlər</option>
          {brands.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Bütün kateqoriyalar</option>
          {catNames.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn secondary" onClick={exportXlsx} disabled={!filtered.length} title="Süzgəcdən keçən məhsulları Excel-ə yaz">
          <Download size={14} /> Excel-ə çıxar
        </button>
        <select value={store} onChange={(e) => setStore(e.target.value)} title="Marketə görə süzgəc">
          <option value="">Bütün marketlər</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name} ({storeCounts[s.id] ?? 0})</option>)}
        </select>
        {store && (
          <select value={storeMode} onChange={(e) => setStoreMode(e.target.value as 'has' | 'missing')} title="Seçilmiş marketdə qiymət vəziyyəti">
            <option value="has">Qiyməti var</option>
            <option value="missing">Qiyməti yoxdur</option>
          </select>
        )}
        <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as '' | 'none' | 'partial')} title="Qiymət vəziyyəti">
          <option value="">Bütün məhsullar</option>
          <option value="none">Heç bir marketdə qiyməti yoxdur ({noPriceCount})</option>
          <option value="partial">Bəzi marketlərdə qiyməti yoxdur</option>
        </select>
        <button
          className={`btn ghost${noImageFilter ? ' active' : ''}`}
          onClick={() => setNoImageFilter((v) => !v)}
          title="Yalnız şəkilsiz məhsullar"
        >
          <Camera size={14} /> Şəkilsiz ({noImageCount})
        </button>
        {priceFilter === 'none' && filtered.length > 0 && <button className="btn danger" disabled={busy} onClick={removeFiltered}><Trash2 size={14} /> Filtrdəkiləri sil ({filtered.length})</button>}
        <button className="btn ghost" disabled={dupBusy} onClick={findDups}><Copy size={14} /> Dublikatları tap</button>
        <button className="btn" onClick={() => open({ ...EMPTY, category: catNames[0] ?? CATEGORIES[0] })}><Plus size={14} /> Yeni məhsul</button>
      </div>

      {stores.length === 0 && <div className="alert err">Əvvəlcə "Marketlər" səhifəsində ən azı bir market əlavə et.</div>}

      {/* ── Bulk toolbar (visible when items selected) ── */}
      {selected.size > 0 && (
        <div className="toolbar" style={{ background: 'var(--accent-bg, #EFF6FF)', borderRadius: 8, padding: '8px 12px', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{selected.size} seçilib</span>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>

          {/* Category bulk */}
          <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} style={{ minWidth: 160 }}>
            <option value="">Kateqoriya seç…</option>
            {catNames.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn" disabled={!bulkCat || bulkBusy} onClick={bulkApplyCategory}>Tətbiq et</button>

          <span style={{ color: 'var(--muted)', fontSize: 12 }}>|</span>

          {/* Emoji bulk */}
          <input
            value={bulkEmoji}
            onChange={(e) => setBulkEmoji(e.target.value)}
            placeholder="Emoji…"
            style={{ width: 80 }}
          />
          <button className="btn" disabled={!bulkEmoji || bulkBusy} onClick={bulkApplyEmoji}>Emoji tətbiq et</button>

          <span style={{ color: 'var(--muted)', fontSize: 12 }}>|</span>

          {/* Fetch images for selected */}
          <button className="btn ghost" disabled={bulkBusy} onClick={bulkFetchImages}><Camera size={14} /> Şəkilsizlərə Wolt şəkli tap</button>

          {/* Bulk delete */}
          <button className="btn danger" disabled={bulkBusy} onClick={bulkDelete}><Trash2 size={14} /> Sil</button>

          <button className="btn ghost" onClick={() => setSelected(new Set())} title="Seçimi ləğv et"><X size={14} /></button>
        </div>
      )}

      {/* ── Products table ── */}
      <table>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allFilteredSelected; }}
                onChange={toggleAll}
                title="Hamısını seç / seçimi götür"
              />
            </th>
            <th>Məhsul</th>
            <th>Kateqoriya</th>
            <th>Qiymətlər (market · qiymət)</th>
            <th>Ən ucuz</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {paged.map((p) => {
            const best = cheapestStore(p.id);
            const fetchState = imageFetch[p.id];
            return (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => open(p)}>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Image / emoji + fetch button */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {p.image_url
                        ? <img src={p.image_url} alt="" width={34} height={34} style={{ borderRadius: 8, objectFit: 'cover', display: 'block' }} />
                        : <span style={{ fontSize: 22, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p.emoji}</span>}
                      {!p.image_url && (
                        <button
                          className="btn ghost"
                          style={{ position: 'absolute', inset: 0, padding: 0, opacity: fetchState === 'loading' ? 1 : 0, background: 'rgba(0,0,0,.45)', borderRadius: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity .15s' }}
                          title="Wolt-dan şəkil tap"
                          onClick={(e) => { e.stopPropagation(); fetchImage(p); }}
                        >
                          {fetchState === 'loading' ? '…' : fetchState === 'error' ? '✗' : <Camera size={14} />}
                        </button>
                      )}
                    </div>
                    <div>
                      <b>{p.brand}</b> {p.name} <span className="muted">{p.size}</span>
                      {!p.image_url && fetchState !== 'loading' && (
                        <button
                          className="btn ghost"
                          style={{ fontSize: 11, padding: '1px 6px', marginLeft: 6, verticalAlign: 'middle', color: fetchState === 'error' ? '#EF4444' : undefined }}
                          title="Wolt-dan şəkil tap"
                          onClick={(e) => { e.stopPropagation(); fetchImage(p); }}
                        >
                          {fetchState === 'error' ? 'tapılmadı' : <><Camera size={11} /> Şəkil tap</>}
                        </button>
                      )}
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
          {paged.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 30 }}>Məhsul yoxdur — "Yeni məhsul" ilə və ya "Wolt-dan import" ilə əlavə et.</td></tr>}
        </tbody>
      </table>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', flexWrap: 'wrap' }}>
          <button className="btn ghost" disabled={safePage <= 1} onClick={() => setPage(1)} title="İlk səhifə">«</button>
          <button className="btn ghost" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce<(number | '…')[]>((acc, p, i, arr) => {
              if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === '…'
                ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--muted)' }}>…</span>
                : <button key={p} className={`btn${safePage === p ? '' : ' ghost'}`} onClick={() => setPage(p as number)} style={{ minWidth: 34 }}>{p}</button>
            )}
          <button className="btn ghost" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={15} /></button>
          <button className="btn ghost" disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} title="Son səhifə">»</button>
          <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length} məhsul
          </span>
          <span className="muted" style={{ fontSize: 12 }}>· Səhifə:</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={safePage}
            onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
            style={{ width: 56, textAlign: 'center' }}
          />
          <span className="muted" style={{ fontSize: 12 }}>/ {totalPages}</span>
        </div>
      )}
      {totalPages <= 1 && filtered.length > 0 && (
        <p className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '8px 0' }}>{filtered.length} məhsul</p>
      )}

      <p className="note">Məhsula klik et: bir pəncərədə məlumatları və hər market üçün adi / endirimli qiyməti yaz. Yaşıl çip endirimin olduğunu göstərir. Hər dəyişiklik qiymət tarixçəsinə avtomatik yazılır. <b>Heç bir marketdə qiyməti olmayan məhsul tətbiqdə görünmür</b>; digər marketlərin qiymətini "Avtomatik yeniləmə"də həmin marketin Wolt mənbəsi ilə doldur.</p>

      {/* ── Image preview modal ── */}
      {imagePreview && (
        <div className="modal-bg" onClick={() => setImagePreview(null)}>
          <div className="modal" style={{ width: 'min(480px,100%)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Tapılan şəkil</h2>
              <button className="btn ghost" onClick={() => setImagePreview(null)}><X size={18} /></button>
            </div>
            <p className="muted" style={{ margin: '8px 0' }}>{imagePreview.venue} → {imagePreview.item_name}</p>
            <img src={imagePreview.image_url} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--border)' }} />
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn secondary" onClick={() => setImagePreview(null)}>Ləğv et</button>
              <button className="btn" disabled={busy} onClick={saveImagePreview}>Saxla</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Duplicate detection modal ── */}
      {dupGroups !== null && (
        <div className="modal-bg" onClick={() => !dupMerging && setDupGroups(null)}>
          <div className="modal" style={{ width: 'min(860px,100%)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Dublikat məhsullar {dupGroups.length > 0 && <span className="pill gray" style={{ fontSize: 13, marginLeft: 6 }}>{dupGroups.length} qrup</span>}</h2>
              <button className="btn ghost" disabled={dupMerging} onClick={() => setDupGroups(null)}><X size={18} /></button>
            </div>
            {dupGroups.length === 0
              ? <p className="muted" style={{ textAlign: 'center', padding: 30 }}>Dublikat tapılmadı.</p>
              : <>
                {/* Bulk action bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={dupGroups.length > 0 && dupGroups.every((g) => dupSelected.has(g.key))}
                      ref={(el) => { if (el) el.indeterminate = dupSelected.size > 0 && !dupGroups.every((g) => dupSelected.has(g.key)); }}
                      onChange={() => {
                        const allSel = dupGroups.every((g) => dupSelected.has(g.key));
                        setDupSelected(allSel ? new Set() : new Set(dupGroups.map((g) => g.key)));
                      }}
                    />
                    <span style={{ fontSize: 13 }}>Hamısını seç</span>
                  </label>
                  {dupSelected.size > 0 && (
                    <button className="btn danger" disabled={dupMerging} onClick={() => mergeBulkDups(dupGroups.filter((g) => dupSelected.has(g.key)))}>
                      {dupMerging && dupProgress ? `Birləşdirilir… ${dupProgress.done}/${dupProgress.total}` : `Seçilənləri birləşdir (${dupSelected.size})`}
                    </button>
                  )}
                  <button className="btn danger" disabled={dupMerging} style={{ marginLeft: 'auto' }} onClick={() => mergeBulkDups(dupGroups)}>
                    {dupMerging && dupProgress && dupSelected.size === 0 ? `Birləşdirilir… ${dupProgress.done}/${dupProgress.total}` : `Hamısını birləşdir (${dupGroups.length})`}
                  </button>
                </div>
                {dupProgress && (
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, margin: '6px 0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#EF4444', borderRadius: 2, width: `${(dupProgress.done / dupProgress.total) * 100}%`, transition: 'width .2s' }} />
                  </div>
                )}
                {dupGroups.map((group) => (
                  <div key={group.key} style={{ marginTop: 16, border: `2px solid ${dupSelected.has(group.key) ? '#EF4444' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--accent-bg, #F0F9FF)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={dupSelected.has(group.key)}
                          onChange={() => setDupSelected((prev) => { const next = new Set(prev); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}
                        />
                        <b style={{ fontSize: 13 }}>{group.key}</b>
                        <span className="muted" style={{ fontSize: 11 }}>{group.products.length - 1} dublikat</span>
                      </label>
                      <button className="btn danger" disabled={busy || dupMerging} onClick={() => mergeDupGroup(group)}>
                        Birləşdir
                      </button>
                    </div>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>Saxla</th>
                          <th>Məhsul</th>
                          <th>Kateqoriya</th>
                          <th>Şəkil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.products.map((p) => (
                          <tr key={p.id} style={{ background: dupKeep[group.key] === p.id ? 'var(--accent-bg, #F0FDF4)' : undefined }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`keep-${group.key}`}
                                checked={dupKeep[group.key] === p.id}
                                onChange={() => setDupKeep((prev) => ({ ...prev, [group.key]: p.id }))}
                              />
                            </td>
                            <td>
                              <b>{p.brand}</b> {p.name} <span className="muted">{p.size}</span>
                              <div className="muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.id}</div>
                            </td>
                            <td className="muted">{p.category}</td>
                            <td>
                              {p.image_url
                                ? <img src={p.image_url} alt="" width={34} height={34} style={{ borderRadius: 6, objectFit: 'cover' }} />
                                : <span className="muted" style={{ fontSize: 11 }}>yoxdur</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>}
          </div>
        </div>
      )}

      {/* ── Edit / new product modal ── */}
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
