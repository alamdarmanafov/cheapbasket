'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Search, Tags } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PriceRow, Product, Store, db, slugify, useCategories } from '@/lib/supabase';
import { buildMatcher, mapCategory, splitName, type WoltItem, type WoltResult } from '@/lib/wolt';

interface Row extends WoltItem {
  key: string;
  selected: boolean;
  appCategory: string;
  /** editable product fields (pre-filled from the Wolt name) */
  brand: string;
  title: string;
  size: string;
  priceText: string;
  discountText: string;
  /** existing product id when the barcode is already in the catalogue */
  existingId: string | null;
  /** for existing products: also overwrite name/brand/size/category/image from Wolt (default: price only) */
  updateInfo: boolean;
  /** current price stored in DB for the selected store (null = not stored yet) */
  dbPrice: number | null;
}

export default function ImportPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [url, setUrl] = useState('https://wolt.com/az/aze/baku/venue/wolt-market-landmark');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WoltResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  /** Hide products that are already in the catalogue (they are never created twice anyway). */
  const [onlyNew, setOnlyNew] = useState(false);
  /** Prices-only: match Wolt items to products already in the catalogue (barcode, then name) and write just the prices. */
  const [pricesOnly, setPricesOnly] = useState(false);
  /** Products-only: create/update products without writing any price (catalogue sites that are not a store). */
  const [productsOnly, setProductsOnly] = useState(false);
  /** Optional discount validity window applied to all rows that have a discount price. */
  const [discountFrom, setDiscountFrom] = useState('');
  const [discountUntil, setDiscountUntil] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Product[]>([]);
  /** product_id → effective price currently stored for the selected store */
  const [dbPriceMap, setDbPriceMap] = useState<Map<string, number>>(new Map());
  const { categories: ourCategories, names: catNames, reload: reloadCategories } = useCategories();

  useEffect(() => {
    db.select<Store>('stores', { order: 'name' }).then((s) => { setStores(s); if (s[0]) setStoreId(s[0].id); }).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url' }).then(setExisting).catch(() => {});
  }, []);

  // Reload stored prices for the selected store whenever storeId changes.
  useEffect(() => {
    if (!storeId) return;
    db.select<PriceRow>('prices', { columns: 'product_id,price,discount_price', eq: { store_id: storeId } })
      .then((rows) => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const eff = r.discount_price != null && r.discount_price < (r.price ?? Infinity) ? r.discount_price : r.price;
          if (eff != null) m.set(r.product_id, eff);
        }
        setDbPriceMap(m);
        // Refresh dbPrice on existing rows when store changes.
        setRows((prev) => prev.map((r) => r.existingId ? { ...r, dbPrice: m.get(r.existingId) ?? null } : r));
      })
      .catch(() => {});
  }, [storeId]);

  const matcher = (list: Product[]) => buildMatcher(list.map((p) => ({ id: p.id, barcode: p.barcode, brand: p.brand, name: p.name, size: p.size })));

  const load = async () => {
    setLoading(true);
    setMsg(null);
    setResult(null);
    setRows([]);
    try {
      const res = await fetch('/api/import/wolt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const j = (await res.json()) as WoltResult & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const match = matcher(existing);
      setResult(j);
      setRows(
        j.items.map((it) => {
          const sp = splitName(it.name ?? '');
          const existingId = match(it);
          return {
            ...it,
            key: it.ext_id,
            selected: productsOnly ? !existingId : it.price != null,
            appCategory: it.category && catNames.includes(it.category) ? it.category : mapCategory(it.category, it.name ?? '', catNames),
            existingId,
            updateInfo: false,
            brand: sp.brand,
            title: sp.name,
            size: sp.size,
            priceText: it.regular_price != null ? it.regular_price.toFixed(2) : it.price != null ? it.price.toFixed(2) : '',
            discountText: it.regular_price != null && it.price != null ? it.price.toFixed(2) : '',
            dbPrice: existingId ? (dbPriceMap.get(existingId) ?? null) : null,
          };
        }),
      );
      const matched = j.items.filter((it) => match(it)).length;
      setMsg({ ok: true, text: `${j.items.length} məhsul tapıldı${j.venue ? ` · ${j.venue}` : ''}. ${j.items.length - matched} yeni, ${matched} artıq bazada var (təkrar yaradılmır), ${j.items.filter((i) => i.regular_price != null).length} endirimli.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (!n || r.name.toLowerCase().includes(n) || (r.barcode ?? '').includes(n)) && (!cat || r.category === cat) && (!onlyDiscount || r.regular_price != null) && (!pricesOnly || r.existingId) && (!onlyNew || !r.existingId));
  }, [rows, q, cat, onlyDiscount, pricesOnly, onlyNew]);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const valid = (r: Row) => {
    const title = (r.title ?? '').trim();
    if (productsOnly) return title !== '';
    const p = num(r.priceText);
    const d = num(r.discountText);
    return p != null && !Number.isNaN(p) && p > 0 && (d == null || (!Number.isNaN(d) && d > 0 && d < p)) && title !== '';
  };
  const eligible = (r: Row) => valid(r) && (!pricesOnly || !!r.existingId);
  const selected = rows.filter((r) => r.selected && eligible(r));
  const setAll = (v: boolean) => setRows(rows.map((r) => (filtered.includes(r) ? { ...r, selected: v && eligible(r) } : r)));
  const patch = (key: string, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** One-time: adopt the venue's category names as our own categories, then re-map rows to them. */
  const adoptCategories = async () => {
    if (!result) return;
    const have = new Set(ourCategories.map((c) => c.name.toLowerCase()));
    const fresh = result.categories.filter((c) => !have.has(c.toLowerCase()));
    if (!fresh.length) { setMsg({ ok: true, text: 'Bu kateqoriyalar artıq bizdə var.' }); return; }
    setBusy(true);
    try {
      let sort = ourCategories.length;
      const byId = new Map<string, Record<string, unknown>>();
      for (const name of fresh) {
        const id = slugify(name) || `cat-${sort}`;
        if (!byId.has(id)) byId.set(id, { id, name, emoji: null, sort: sort++ });
      }
      await db.upsert('categories', [...byId.values()], 'id');
      await reloadCategories();
      setRows(rows.map((r) => (r.category && !r.existingId ? { ...r, appCategory: r.category } : r)));
      setMsg({ ok: true, text: `${fresh.length} kateqoriya əlavə olundu ("Kateqoriyalar" səhifəsində emoji və sıra verə bilərsən). Sətirlər Wolt kateqoriyasına uyğunlaşdırıldı.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const importSelected = async () => {
    if (!storeId && !productsOnly) { setMsg({ ok: false, text: 'Əvvəlcə market seç (və ya "Yalnız məhsullar" rejimini seç).' }); return; }
    const storeName = productsOnly ? 'qiymətsiz' : stores.find((s) => s.id === storeId)?.name ?? storeId;
    const newCount = selected.filter((r) => !r.existingId).length;
    const infoCount = selected.filter((r) => r.existingId && r.updateInfo).length;
    const priceOnly = selected.length - newCount - infoCount;
    const plan = [
      newCount ? (productsOnly ? `${newCount} yeni məhsul yaradılacaq (ad, kateqoriya, şəkil; qiymət yazılmır)` : `${newCount} yeni məhsul yaradılacaq (ad, kateqoriya, şəkil + ${storeName} qiyməti)`) : null,
      priceOnly ? `${priceOnly} mövcud məhsulun YALNIZ ${storeName} qiyməti yazılacaq` : null,
      infoCount ? `${infoCount} mövcud məhsulun məlumatı (ad, ölçü, kateqoriya, şəkil) da Wolt-dakı ilə əvəz olunacaq` : null,
    ].filter(Boolean).join('\n• ');
    if (!confirm(`Nə yazılacaq:\n• ${plan}\n\nDavam edilsin?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      // Fresh snapshot of the catalogue so a product created meanwhile (or by an earlier batch) is only price-updated.
      const fresh = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url' });
      const match = matcher(fresh);
      const products: Record<string, unknown>[] = [];
      const infoUpdates: Record<string, unknown>[] = []; // existing products whose details are refreshed (barcode untouched)
      const photoUpdates: Array<{ id: string; image_url: string }> = []; // existing products that had no photo
      const priceById = new Map<string, Record<string, unknown>>();
      const now = new Date().toISOString();
      const usedIds = new Set<string>();
      const idByBarcode = new Map<string, string>(); // barcode → product id inside this batch
      let updated = 0;
      for (const r of selected) {
        const known = r.existingId ?? match(r) ?? (r.barcode ? idByBarcode.get(r.barcode) : undefined) ?? (usedIds.has(r.barcode ?? `wolt-${slugify(r.name)}`) ? (r.barcode ?? `wolt-${slugify(r.name)}`) : null);
        let id = known ?? r.barcode ?? `wolt-${slugify(r.name)}`;
        if (!known && usedIds.has(id)) id = `${id}-${r.ext_id.slice(-4)}`;
        usedIds.add(id);
        if (r.barcode) idByBarcode.set(r.barcode, id);
        if (!known) {
          const name = (r.title ?? '').trim();
          if (!name) continue; // skip rows with no name (defensive)
          products.push({ id, barcode: r.barcode, name, brand: (r.brand ?? '').trim(), size: (r.size ?? '').trim() || '—', category: r.appCategory, emoji: '🛒', tint: '#F3F4F6', image_url: r.image_url });
        } else {
          updated++;
          // several Wolt rows can map to one product (same barcode / name) → keep a single info update per id
          if (r.updateInfo && !infoUpdates.some((u) => u.id === id)) infoUpdates.push({ id, name: r.title.trim(), brand: r.brand.trim(), size: r.size.trim() || '—', category: r.appCategory, image_url: r.image_url });
          // no photo in our catalogue yet → take Wolt's (never replaces an existing photo)
          else if (!r.updateInfo && r.image_url && !fresh.find((p) => p.id === id)?.image_url && !photoUpdates.some((u) => u.id === id)) photoUpdates.push({ id, image_url: r.image_url });
        }
        if (productsOnly || num(r.priceText) == null) continue; // no price to write
        // one price row per product (a duplicate barcode in the venue keeps the first / cheaper price)
        const prev = priceById.get(id);
        const hasDiscount = num(r.discountText) != null;
        const candidate = {
          product_id: id, store_id: storeId,
          price: num(r.priceText), discount_price: num(r.discountText),
          discount_starts: hasDiscount && discountFrom  ? discountFrom  : null,
          discount_ends:   hasDiscount && discountUntil ? discountUntil : null,
          updated_at: now,
        };
        const eff = (x: Record<string, unknown>) => (x.discount_price as number | null) ?? (x.price as number);
        if (!prev || eff(candidate) < eff(prev)) priceById.set(id, candidate);
      }
      const prices = [...priceById.values()];
      for (let i = 0; i < products.length; i += 200) await db.upsert('products', products.slice(i, i + 200), 'id');
      for (let i = 0; i < infoUpdates.length; i += 200) await db.upsert('products', infoUpdates.slice(i, i + 200), 'id');
      for (let i = 0; i < photoUpdates.length; i += 200) await db.upsert('products', photoUpdates.slice(i, i + 200), 'id');
      for (let i = 0; i < prices.length; i += 200) await db.upsert('prices', prices.slice(i, i + 200), 'product_id,store_id');
      // Instant "basket item got cheaper" pushes for any drop this import produced.
      const alertRes = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: new Date(Date.now() - 5 * 60000).toISOString() }) }).then((r) => r.json()).catch(() => null);
      setMsg({ ok: true, text: `${prices.length} qiymət yazıldı → ${storeName}: ${products.length} yeni məhsul, ${updated - infoUpdates.length} mövcud məhsul yalnız qiymətlə, ${infoUpdates.length} mövcud məhsul məlumatı ilə birlikdə yeniləndi${photoUpdates.length ? `, ${photoUpdates.length} məhsula Wolt şəkli qoyuldu` : ''}.${alertRes?.users ? ` ${alertRes.users} istifadəçiyə qiymət düşüşü bildirişi getdi.` : ''}` });
      if (confirm(`Bu Wolt səhifəsi "${storeName}" üçün mənbə kimi yadda saxlansın? Sonra "Avtomatik yeniləmə" səhifəsində bir kliklə (və hər həftə avtomatik) qiymətlər yenilənir.`)) {
        await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'add', store_id: storeId, url }) }).catch(() => null);
      }
      const ex = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url' });
      setExisting(ex);
      const rematch = matcher(ex);
      setRows(rows.map((r) => ({ ...r, existingId: rematch(r) ?? r.existingId })));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Saytdan import">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <input placeholder="Wolt linki və ya istənilən market saytının məhsul/kateqoriya səhifəsi: https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} title="Qiymətlər hansı marketə yazılsın">
          {stores.length === 0 && <option value="">Market yoxdur</option>}
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }} title="Sayt market deyilsə: məhsulları (ad, şəkil, barkod, kateqoriya) yarat, qiymət yazma; qiymətləri sonra Wolt mənbələri və ya əl ilə doldur">
          <input type="checkbox" checked={productsOnly} onChange={(e) => { setProductsOnly(e.target.checked); if (e.target.checked) setPricesOnly(false); }} style={{ width: 'auto' }} /> Yalnız məhsullar
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }} title="Yeni məhsul yaratmır; yalnız bazada olan məhsulların bu marketdəki qiymətini yazır">
          <input type="checkbox" checked={pricesOnly} onChange={(e) => { setPricesOnly(e.target.checked); if (e.target.checked) { setProductsOnly(false); setRows(rows.map((r) => ({ ...r, selected: r.selected && !!r.existingId }))); } }} style={{ width: 'auto' }} /> Yalnız qiymətlər
        </label>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }} title="Endirimli qiymətlər üçün keçərlilik aralığı. Boş qoysan tarix olmadan yazılır.">
          Endirim:
          <input type="date" value={discountFrom} onChange={(e) => setDiscountFrom(e.target.value)} style={{ width: 130 }} title="Başlayır" />
          –
          <input type="date" value={discountUntil} onChange={(e) => setDiscountUntil(e.target.value)} style={{ width: 130 }} title="Bitir" />
        </span>
        <button className="btn secondary" disabled={loading || !url} onClick={load}><Download size={14} /> {loading ? 'Yüklənir…' : 'Məhsulları çək'}</button>
        <button className="btn" disabled={!selected.length || busy || (!storeId && !productsOnly)} onClick={importSelected}>{busy ? 'Yazılır…' : `Seçilənləri import et (${selected.length})`}</button>
      </div>
      <p className="note">
        Wolt linki və ya istənilən market saytının səhifəsini yapışdır. Səhifələnmiş siyahılarda (səhifə 1, 2, 3…) növbəti səhifələr avtomatik oxunur — bir dəfəyə 1000 məhsula qədər. Wolt API ilə, digər saytlar səhifədəki strukturlu məlumatla (JSON-LD/OpenGraph) oxunur; o yoxdursa səhifə mətni AI-a verilir (səhifə başına ≈ 0.01 $, OPENAI_API_KEY lazımdır). Yalnız JavaScript ilə yüklənən səhifələr oxunmur. Soldakı siyahıdan hansı marketə yazılacağını seç (məs. Wolt Market özü ayrıca market kimi "Marketlər" səhifəsində əlavə oluna bilər, Araz/Bravo filialının Wolt səhifəsi isə həmin markete yazılır).
        Yazmazdan əvvəl brend, ad, ölçü, kateqoriya və qiymətləri cədvəldə düzəldə bilərsən. Bazada olan məhsul (barkod və ya eyni ad üzrə) təkrar yaradılmır, yalnız qiyməti yenilənir.
        <b> "Yalnız məhsullar"</b> rejimi market olmayan kataloq saytları üçündür: məhsul yaranır, qiymət yazılmır, qiymətləri sonra hər marketin öz mənbəyindən ("Avtomatik yeniləmə") və ya əl ilə doldurursan.
        <b> "Yalnız qiymətlər"</b> rejimi digər marketlərin Wolt səhifəsi üçündür: yeni məhsul yaratmır, yalnız artıq bazada olan məhsulların seçdiyin marketdəki qiymətini yazır. Wolt qiymətləri mağaza rəfindəki qiymətdən fərqlənə bilər.
      </p>

      {rows.length > 0 && (
        <>
          <div className="alert ok" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><b>{selected.filter((r) => !r.existingId).length}</b> yeni məhsul + qiymət</span>
            <span><b>{selected.filter((r) => r.existingId && !r.updateInfo).length}</b> mövcud məhsul · yalnız qiymət</span>
            <span><b>{selected.filter((r) => r.existingId && r.updateInfo).length}</b> mövcud məhsul · məlumat + qiymət</span>
            <span className="muted">→ {productsOnly ? 'yalnız məhsullar, qiymət yazılmır' : stores.find((s) => s.id === storeId)?.name ?? 'market seçilməyib'}</span>
          </div>
          <div className="toolbar" style={{ marginTop: 14 }}>
            <Search size={16} className="muted" />
            <input placeholder="Ad və ya barkod…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Bütün kateqoriyalar ({pricesOnly ? rows.filter((r) => r.existingId).length : rows.length})</option>
              {result?.categories.map((c) => <option key={c} value={c}>{c} ({rows.filter((r) => r.category === c).length})</option>)}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={onlyDiscount} onChange={(e) => setOnlyDiscount(e.target.checked)} /> Yalnız endirimlilər</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }} title="Bazada olan məhsulları gizlət; yalnız yeni məhsullar qalsın"><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Yalnız yenilər ({rows.filter((r) => !r.existingId).length})</label>
            <button className="btn secondary" disabled={busy || !result?.categories.length} onClick={adoptCategories} title="Wolt-un kateqoriya adlarını bizim kateqoriya siyahısına əlavə et"><Tags size={14} /> Kateqoriyaları götür ({result?.categories.length ?? 0})</button>
            <button className="btn ghost" onClick={() => setAll(true)}>Hamısını seç</button>
            <button className="btn ghost" onClick={() => setAll(false)}>Seçimi sil</button>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }} title="Bazada olan məhsulların adı, ölçüsü, kateqoriyası və şəkli də Wolt-dakı ilə əvəz olunsun">
              <input type="checkbox" checked={rows.some((r) => r.existingId) && rows.filter((r) => r.existingId).every((r) => r.updateInfo)} onChange={(e) => setRows(rows.map((r) => (r.existingId ? { ...r, updateInfo: e.target.checked } : r)))} style={{ width: 'auto' }} /> Mövcudların məlumatını da yenilə
            </label>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th></th><th>Wolt adı</th><th>Brend</th><th>Ad</th><th>Ölçü</th><th>Kateqoriya</th><th>Barkod</th><th style={{ textAlign: 'right' }}>Adi ₼</th><th style={{ textAlign: 'right' }}>Endirim ₼</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
                  <tr key={r.key} style={{ opacity: eligible(r) ? 1 : 0.6, background: r.selected && eligible(r) ? '#FFF7F7' : undefined }}>
                    <td><input type="checkbox" checked={r.selected && eligible(r)} disabled={!eligible(r)} onChange={(e) => patch(r.key, { selected: e.target.checked })} /></td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 260 }}>
                      {r.image_url ? <img src={r.image_url} alt="" width={32} height={32} style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 32, flexShrink: 0 }} />}
                      <span style={{ fontSize: 12 }} title={r.category ?? ''}>{r.name}{r.category ? <span className="muted"> · {r.category}</span> : null}</span>
                    </td>
                    <td><input value={r.brand} placeholder="Brend" style={{ width: 90 }} onChange={(e) => patch(r.key, { brand: e.target.value })} disabled={!!r.existingId && !r.updateInfo} /></td>
                    <td><input value={r.title} placeholder="Ad" style={{ width: 160 }} onChange={(e) => patch(r.key, { title: e.target.value })} disabled={!!r.existingId && !r.updateInfo} /></td>
                    <td><input value={r.size} placeholder="1 L" style={{ width: 64 }} onChange={(e) => patch(r.key, { size: e.target.value })} disabled={!!r.existingId && !r.updateInfo} /></td>
                    <td><select value={r.appCategory} onChange={(e) => patch(r.key, { appCategory: e.target.value })} disabled={!!r.existingId && !r.updateInfo}>{[...new Set([...catNames, r.appCategory])].map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.barcode ?? '—'}</td>
                    <td>
                      <input inputMode="decimal" value={r.priceText} placeholder="—" style={{ width: 64, textAlign: 'right', textDecoration: r.discountText ? 'line-through' : undefined, color: r.discountText ? '#9CA3AF' : undefined }} onChange={(e) => patch(r.key, { priceText: e.target.value })} />
                      {r.dbPrice != null && <div style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right', marginTop: 2 }}>DB: {r.dbPrice.toFixed(2)} ₼{num(r.discountText ?? r.priceText) != null && num(r.discountText ?? r.priceText)! < r.dbPrice ? <span style={{ color: '#16A34A' }}> ↓</span> : num(r.priceText) != null && num(r.priceText)! > r.dbPrice ? <span style={{ color: '#E53935' }}> ↑</span> : <span> =</span>}</div>}
                    </td>
                    <td><input inputMode="decimal" value={r.discountText} placeholder="endirim" style={{ width: 64, textAlign: 'right', color: '#16A34A', fontWeight: 600 }} onChange={(e) => patch(r.key, { discountText: e.target.value })} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {r.existingId ? (
                        <>
                          <span className="pill gray" title={`Mövcud məhsul: ${r.existingId}`}>bazada var · {r.updateInfo ? 'məlumat + qiymət' : 'yalnız qiymət'}</span>
                          <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginTop: 4, cursor: 'pointer' }}>
                            <input type="checkbox" checked={r.updateInfo} onChange={(e) => patch(r.key, { updateInfo: e.target.checked })} style={{ width: 'auto', marginRight: 4 }} />
                            məlumatı da yenilə
                          </label>
                        </>
                      ) : pricesOnly ? <span className="pill red">uyğun gəlmədi</span> : <span className="pill green">yeni məhsul + qiymət</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && <p className="note">İlk 500 sətir göstərilir, axtarış və ya kateqoriya ilə daralt (seçim bütün siyahıya tətbiq olunur).</p>}
          {result && <p className="note">Mənbə: {result.debug.endpoint}{result.debug.sampleKeys.length ? ` · sahələr: ${result.debug.sampleKeys.join(', ')}` : ''} · şəkilli: {rows.filter((r) => r.image_url).length}/{rows.length}</p>}
        </>
      )}
    </Shell>
  );
}
