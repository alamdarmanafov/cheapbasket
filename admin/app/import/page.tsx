'use client';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Search, Tags, Upload } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { PriceRow, Product, Store, db, slugify, useCategories } from '@/lib/supabase';
import { buildMatcher, mapCategory, splitName, type WoltItem, type WoltResult } from '@/lib/wolt';

interface Row extends WoltItem {
  key: string;
  selected: boolean;
  appCategory: string;
  brand: string;
  title: string;
  size: string;
  priceText: string;
  discountText: string;
  existingId: string | null;
  updateInfo: boolean;
  dbPrice: number | null;
}

// ---- CSV parser (no external library) ----
function parseCSV(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delimiter) { row.push(field); field = ''; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field); field = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        row.push(field); field = '';
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length) { row.push(field); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

function detectDelimiter(text: string): ',' | ';' {
  const sample = text.slice(0, 2000);
  const commas = (sample.match(/,/g) ?? []).length;
  const semis = (sample.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

interface CSVRow { barcode: string; name: string; brand: string; size: string; category: string; price: string; discount_price: string }

type ImportTab = 'wolt' | 'csv';

// ---- Discount preset helpers ----
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function sundayStr() {
  const d = new Date();
  d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7);
  return d.toISOString().slice(0, 10);
}
function endOfMonthStr() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}
function plusDaysStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function ImportPage() {
  const [tab, setTab] = useState<ImportTab>('wolt');

  // --- Wolt tab state ---
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [url, setUrl] = useState('https://wolt.com/az/aze/baku/venue/wolt-market-landmark');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WoltResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [pricesOnly, setPricesOnly] = useState(false);
  const [productsOnly, setProductsOnly] = useState(false);
  const [discountFrom, setDiscountFrom] = useState('');
  const [discountUntil, setDiscountUntil] = useState('');
  const [discountPreset, setDiscountPreset] = useState<'none' | 'week' | 'month' | '30' | 'custom'>('none');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Product[]>([]);
  const [dbPriceMap, setDbPriceMap] = useState<Map<string, number>>(new Map());
  const { categories: ourCategories, names: catNames, reload: reloadCategories } = useCategories();

  // --- CSV tab state ---
  const [csvStoreId, setCsvStoreId] = useState('');
  const [csvFiles, setCsvFiles] = useState<File[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({});
  const [csvMsg, setCsvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvPricesOnly, setCsvPricesOnly] = useState(false);

  useEffect(() => {
    db.select<Store>('stores', { order: 'name' }).then((s) => {
      setStores(s);
      if (s[0]) { setStoreId(s[0].id); setCsvStoreId(s[0].id); }
    }).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url', fetchAll: true }).then(setExisting).catch(() => {});
  }, []);

  useEffect(() => {
    if (!storeId) return;
    db.select<PriceRow>('prices', { columns: 'product_id,price,discount_price', eq: { store_id: storeId }, fetchAll: true })
      .then((rows) => {
        const m = new Map<string, number>();
        for (const r of rows) {
          const eff = r.discount_price != null && r.discount_price < (r.price ?? Infinity) ? r.discount_price : r.price;
          if (eff != null) m.set(r.product_id, eff);
        }
        setDbPriceMap(m);
        setRows((prev) => prev.map((r) => r.existingId ? { ...r, dbPrice: m.get(r.existingId) ?? null } : r));
      })
      .catch(() => {});
  }, [storeId]);

  const applyPreset = (preset: 'week' | 'month' | '30' | 'custom') => {
    setDiscountPreset(preset);
    if (preset === 'week') { setDiscountFrom(todayStr()); setDiscountUntil(sundayStr()); }
    else if (preset === 'month') { setDiscountFrom(todayStr()); setDiscountUntil(endOfMonthStr()); }
    else if (preset === '30') { setDiscountFrom(todayStr()); setDiscountUntil(plusDaysStr(30)); }
    // custom: do nothing, let user pick
  };

  const countdown = daysUntil(discountUntil);

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
      setMsg({ ok: true, text: `${fresh.length} kateqoriya əlavə olundu. Sətirlər Wolt kateqoriyasına uyğunlaşdırıldı.` });
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
      const fresh = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url', fetchAll: true });
      const match = matcher(fresh);
      const products: Record<string, unknown>[] = [];
      const infoUpdates: Record<string, unknown>[] = [];
      const photoUpdates: Array<{ id: string; image_url: string }> = [];
      const priceById = new Map<string, Record<string, unknown>>();
      const now = new Date().toISOString();
      const usedIds = new Set<string>();
      const idByBarcode = new Map<string, string>();
      let updated = 0;
      for (const r of selected) {
        const known = r.existingId ?? match(r) ?? (r.barcode ? idByBarcode.get(r.barcode) : undefined) ?? (usedIds.has(r.barcode ?? `wolt-${slugify(r.name)}`) ? (r.barcode ?? `wolt-${slugify(r.name)}`) : null);
        let id = known ?? r.barcode ?? `wolt-${slugify(r.name)}`;
        if (!known && usedIds.has(id)) id = `${id}-${r.ext_id.slice(-4)}`;
        usedIds.add(id);
        if (r.barcode) idByBarcode.set(r.barcode, id);
        if (!known) {
          const name = (r.title ?? '').trim();
          if (!name) continue;
          products.push({ id, barcode: r.barcode, name, brand: (r.brand ?? '').trim(), size: (r.size ?? '').trim() || '—', category: r.appCategory, emoji: '🛒', tint: '#F3F4F6', image_url: r.image_url });
        } else {
          updated++;
          if (r.updateInfo && !infoUpdates.some((u) => u.id === id)) infoUpdates.push({ id, name: r.title.trim(), brand: r.brand.trim(), size: r.size.trim() || '—', category: r.appCategory, image_url: r.image_url });
          else if (!r.updateInfo && r.image_url && !photoUpdates.some((u) => u.id === id)) {
            const fp = fresh.find((p) => p.id === id);
            if (fp && !fp.image_url) photoUpdates.push({ id, image_url: r.image_url });
          }
        }
        if (productsOnly || num(r.priceText) == null) continue;
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
      const alertRes = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: new Date(Date.now() - 5 * 60000).toISOString() }) }).then((r) => r.json()).catch(() => null);
      setMsg({ ok: true, text: `${prices.length} qiymət yazıldı → ${storeName}: ${products.length} yeni məhsul, ${updated - infoUpdates.length} mövcud məhsul yalnız qiymətlə, ${infoUpdates.length} mövcud məhsul məlumatı ilə birlikdə yeniləndi${photoUpdates.length ? `, ${photoUpdates.length} məhsula Wolt şəkli qoyuldu` : ''}.${alertRes?.users ? ` ${alertRes.users} istifadəçiyə qiymət düşüşü bildirişi getdi.` : ''}` });
      if (confirm(`Bu Wolt səhifəsi "${storeName}" üçün mənbə kimi yadda saxlansın?`)) {
        await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'add', store_id: storeId, url }) }).catch(() => null);
      }
      const ex = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url', fetchAll: true });
      setExisting(ex);
      const rematch = matcher(ex);
      setRows(rows.map((r) => ({ ...r, existingId: rematch(r) ?? r.existingId })));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // ---- CSV tab logic ----
  const CSV_FIELDS = ['barcode', 'name', 'brand', 'size', 'category', 'price', 'discount_price'];
  const CSV_LABELS: Record<string, string> = { barcode: 'Barkod', name: 'Ad', brand: 'Brend', size: 'Ölçü', category: 'Kateqoriya', price: 'Qiymət ₼', discount_price: 'Endirim ₼' };

  const parseOneFile = async (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const all = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]).map((row) =>
        (row as unknown[]).map((cell) => (cell == null ? '' : String(cell).trim()))
      );
      return { headers: all[0]?.map((h) => h.trim()) ?? [], rows: all.slice(1) };
    } else {
      const text = await file.text();
      const delim = detectDelimiter(text);
      const all = parseCSV(text, delim);
      return { headers: all[0]?.map((h) => h.trim()) ?? [], rows: all.slice(1) };
    }
  };

  const handleCSVFiles = async (files: FileList) => {
    const fileArr = Array.from(files);
    setCsvFiles(fileArr);
    setCsvRows([]);
    setCsvHeaders([]);
    setCsvMapping({});
    setCsvMsg(null);

    let baseHeaders: string[] = [];
    const allRows: string[][] = [];
    const labels: string[] = [];

    for (const file of fileArr) {
      const { headers, rows } = await parseOneFile(file);
      if (!headers.length || !rows.length) { labels.push(`${file.name}: boş`); continue; }
      if (!baseHeaders.length) baseHeaders = headers;
      allRows.push(...rows);
      labels.push(`${file.name} (${rows.length} sətir)`);
    }

    if (!baseHeaders.length) { setCsvMsg({ ok: false, text: 'Heç bir fayl oxunmadı.' }); return; }
    setCsvHeaders(baseHeaders);
    setCsvRows(allRows);

    const fieldKeywords: Record<string, string[]> = {
      barcode: ['barcode', 'barkod', 'kod', 'ean', 'upc'],
      name: ['name', 'ad', 'məhsul', 'product'],
      brand: ['brand', 'brend', 'marka'],
      size: ['size', 'ölçü', 'həcm', 'weight', 'volume'],
      category: ['category', 'kateqoriya', 'cat'],
      price: ['price', 'qiymət', 'qiymet', 'adi_qiymət'],
      discount_price: ['discount', 'endirim', 'sale', 'discount_price'],
    };
    const autoMap: Record<string, string> = {};
    for (const field of CSV_FIELDS) {
      const kws = fieldKeywords[field];
      const idx = baseHeaders.findIndex((h) => kws.some((k) => h.toLowerCase().includes(k)));
      if (idx >= 0) autoMap[field] = String(idx);
    }
    setCsvMapping(autoMap);
    setCsvMsg({ ok: true, text: `${fileArr.length} fayl, cəmi ${allRows.length} sətir: ${labels.join(' · ')}. Sütunları uyğunlaşdır, sonra "Import et" düyməsinə bas.` });
  };

  const getCsvField = (row: string[], field: string): string => {
    const idx = csvMapping[field];
    if (idx === undefined || idx === '') return '';
    return (row[Number(idx)] ?? '').trim();
  };

  const csvPreview = csvRows.slice(0, 10);

  const importCSV = async () => {
    if (!csvStoreId) { setCsvMsg({ ok: false, text: 'Market seçin.' }); return; }
    if (!csvMapping.name && !csvMapping.barcode) { setCsvMsg({ ok: false, text: '"Ad" və ya "Barkod" sütunu seçilməlidir.' }); return; }
    if (!csvMapping.price) { setCsvMsg({ ok: false, text: '"Qiymət" sütunu seçilməlidir.' }); return; }
    setCsvBusy(true);
    setCsvMsg(null);
    try {
      const fresh = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category, image_url', fetchAll: true });
      const match = buildMatcher(fresh.map((p) => ({ id: p.id, barcode: p.barcode, brand: p.brand, name: p.name, size: p.size })));
      const products: Record<string, unknown>[] = [];
      const priceRows: Record<string, unknown>[] = [];
      const now = new Date().toISOString();
      const usedIds = new Set(fresh.map((p) => p.id));

      for (const row of csvRows) {
        const barcode = getCsvField(row, 'barcode') || null;
        const name = getCsvField(row, 'name');
        const brand = getCsvField(row, 'brand');
        const size = getCsvField(row, 'size') || '—';
        const category = getCsvField(row, 'category') || catNames[0] || 'Qida';
        const priceRaw = getCsvField(row, 'price');
        const discountRaw = getCsvField(row, 'discount_price');
        if (!name && !barcode) continue;
        const parseNum = (s: string) => { const n = Number(s.replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) || n === 0 ? null : n; };
        let price = priceRaw ? parseNum(priceRaw) : null;
        let discount = discountRaw ? parseNum(discountRaw) : null;
        // If only one price value is provided, use it as the regular price
        if (price == null && discount != null) { price = discount; discount = null; }

        const woltLike = { barcode, name: name || barcode || '', brand, size };
        const existingId = match(woltLike as Parameters<typeof match>[0]);
        if (!existingId && csvPricesOnly) continue;
        let id = existingId ?? barcode ?? `csv-${slugify(name || barcode || '')}`;
        if (!existingId) {
          while (usedIds.has(id)) id = `${id}-x`;
          usedIds.add(id);
          products.push({ id, barcode, name: name || barcode, brand: brand || '', size, category, emoji: '🛒', tint: '#F3F4F6', image_url: null });
        }
        if (price != null) {
          priceRows.push({ product_id: id, store_id: csvStoreId, price, discount_price: discount ?? null, discount_starts: null, discount_ends: null, updated_at: now });
        }
      }
      // Deduplicate before upsert to avoid ON CONFLICT affecting same row twice
      const uniqueProducts = [...new Map(products.map((p) => [p.id as string, p])).values()];
      const uniquePrices = [...new Map(priceRows.map((r) => [`${r.product_id}:${r.store_id}`, r])).values()];
      for (let i = 0; i < uniqueProducts.length; i += 200) await db.upsert('products', uniqueProducts.slice(i, i + 200), 'id');
      for (let i = 0; i < uniquePrices.length; i += 200) await db.upsert('prices', uniquePrices.slice(i, i + 200), 'product_id,store_id');
      const storeName = stores.find((s) => s.id === csvStoreId)?.name ?? csvStoreId;
      setCsvMsg({ ok: true, text: `${uniquePrices.length} qiymət, ${uniqueProducts.length} yeni məhsul → ${storeName}.` });
    } catch (e) {
      setCsvMsg({ ok: false, text: (e as Error).message });
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <Shell title="Saytdan import">
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#F3F4F6', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button className={`btn ${tab === 'wolt' ? '' : 'ghost'}`} style={{ borderRadius: 8 }} onClick={() => setTab('wolt')}>🌐 Wolt / sayt</button>
        <button className={`btn ${tab === 'csv' ? '' : 'ghost'}`} style={{ borderRadius: 8 }} onClick={() => setTab('csv')}><Upload size={14} /> CSV / Excel (.xlsx)</button>
      </div>

      {/* ====== WOLT TAB ====== */}
      {tab === 'wolt' && (
        <>
          {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
          <div className="toolbar">
            <input placeholder="Wolt linki və ya istənilən market saytının məhsul/kateqoriya səhifəsi: https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <select value={storeId} onChange={(e) => setStoreId(e.target.value)} title="Qiymətlər hansı marketə yazılsın">
              {stores.length === 0 && <option value="">Market yoxdur</option>}
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={productsOnly} onChange={(e) => { setProductsOnly(e.target.checked); if (e.target.checked) setPricesOnly(false); }} style={{ width: 'auto' }} /> Yalnız məhsullar
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={pricesOnly} onChange={(e) => { setPricesOnly(e.target.checked); if (e.target.checked) { setProductsOnly(false); setRows(rows.map((r) => ({ ...r, selected: r.selected && !!r.existingId }))); } }} style={{ width: 'auto' }} /> Yalnız qiymətlər
            </label>
            <button className="btn secondary" disabled={loading || !url} onClick={load}><Download size={14} /> {loading ? 'Yüklənir…' : 'Məhsulları çək'}</button>
            <button className="btn" disabled={!selected.length || busy || (!storeId && !productsOnly)} onClick={importSelected}>{busy ? 'Yazılır…' : `Seçilənləri import et (${selected.length})`}</button>
          </div>

          {/* Discount date section with presets */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, padding: '10px 12px', background: '#FAFAFA', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>Endirim tarixi:</span>
            {(['week', 'month', '30', 'custom'] as const).map((p) => (
              <button key={p} className={`btn ${discountPreset === p ? '' : 'secondary'}`} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => applyPreset(p)}>
                {p === 'week' ? 'Bu həftə' : p === 'month' ? 'Bu ay' : p === '30' ? '30 gün' : 'Custom'}
              </button>
            ))}
            <input type="date" value={discountFrom} onChange={(e) => { setDiscountFrom(e.target.value); setDiscountPreset('custom'); }} style={{ width: 130 }} title="Başlayır" />
            <span className="muted">–</span>
            <input type="date" value={discountUntil} onChange={(e) => { setDiscountUntil(e.target.value); setDiscountPreset('custom'); }} style={{ width: 130 }} title="Bitir" />
            {countdown != null && discountUntil && (
              <span style={{ fontSize: 12, color: countdown <= 3 ? '#DC2626' : '#6B7280' }}>
                {countdown > 0 ? `${countdown} gün qalır` : countdown === 0 ? 'Bu gün bitir' : 'Müddət bitib'}
              </span>
            )}
          </div>

          <p className="note">
            Wolt linki və ya istənilən market saytının səhifəsini yapışdır. Wolt API ilə, digər saytlar strukturlu məlumatla oxunur.
            <b> "Yalnız məhsullar"</b> rejimi market olmayan kataloq saytları üçündür.
            <b> "Yalnız qiymətlər"</b> rejimi digər marketlərin Wolt səhifəsi üçündür.
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
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> Yalnız yenilər ({rows.filter((r) => !r.existingId).length})</label>
                <button className="btn secondary" disabled={busy || !result?.categories.length} onClick={adoptCategories}><Tags size={14} /> Kateqoriyaları götür ({result?.categories.length ?? 0})</button>
                <button className="btn ghost" onClick={() => setAll(true)}>Hamısını seç</button>
                <button className="btn ghost" onClick={() => setAll(false)}>Seçimi sil</button>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
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
              {filtered.length > 500 && <p className="note">İlk 500 sətir göstərilir, axtarış və ya kateqoriya ilə daralt.</p>}
              {result && <p className="note">Mənbə: {result.debug.endpoint}{result.debug.sampleKeys.length ? ` · sahələr: ${result.debug.sampleKeys.join(', ')}` : ''} · şəkilli: {rows.filter((r) => r.image_url).length}/{rows.length}</p>}
            </>
          )}
        </>
      )}

      {/* ====== CSV TAB ====== */}
      {tab === 'csv' && (
        <div className="card">
          <h2><Upload size={18} style={{ verticalAlign: -3 }} /> CSV / Excel import</h2>
          {csvMsg && <div className={`alert ${csvMsg.ok ? 'ok' : 'err'}`}>{csvMsg.text}</div>}

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>CSV faylı seç</label>
              <input type="file" accept=".csv,.xlsx,.xls" multiple onChange={(e) => { if (e.target.files?.length) handleCSVFiles(e.target.files); }} />
              {csvFiles.length > 1 && <span className="muted" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{csvFiles.length} fayl seçilib</span>}
            </div>
            <div>
              <label style={{ marginBottom: 6, display: 'block', fontWeight: 600 }}>Market</label>
              <select value={csvStoreId} onChange={(e) => setCsvStoreId(e.target.value)}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 24, fontSize: 13 }}>
              <input type="checkbox" checked={csvPricesOnly} onChange={(e) => setCsvPricesOnly(e.target.checked)} style={{ width: 'auto' }} />
              Yalnız mövcud məhsulların qiymətini yenilə (yeni məhsul əlavə etmə)
            </label>
          </div>

          <div className="note" style={{ marginBottom: 14 }}>
            <b>CSV formatı:</b> <code>barkod,ad,brend,ölçü,kateqoriya,qiymət,endirim_qiyməti</code><br />
            Vergül (<code>,</code>) və ya nöqtəli vergül (<code>;</code>) ayırıcı kimi istifadə oluna bilər. Birinci sətir başlıq olmalıdır.<br />
            <b>Excel (.xlsx / .xls):</b> Birbaşa Excel faylını seçin — SheetJS ilə birinci vərəq avtomatik oxunur.
          </div>

          {csvHeaders.length > 0 && (
            <>
              {/* Column mapping */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 10 }}>Sütun uyğunlaşdırması</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {CSV_FIELDS.map((field) => (
                    <label key={field}>
                      {CSV_LABELS[field]}
                      <select value={csvMapping[field] ?? ''} onChange={(e) => setCsvMapping({ ...csvMapping, [field]: e.target.value })}>
                        <option value="">— seçilməyib —</option>
                        {csvHeaders.map((h, i) => <option key={i} value={String(i)}>{h}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ marginBottom: 8 }}>Önizləmə (ilk {csvPreview.length} sətir)</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>{csvHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i}>{csvHeaders.map((_, j) => <td key={j} style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row[j] ?? ''}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>Cəmi: {csvRows.length} sətir</p>
              </div>

              <button className="btn" disabled={csvBusy || !csvRows.length} onClick={importCSV}>
                <Upload size={14} /> {csvBusy ? 'İmport olunur…' : `Import et (${csvRows.length} sətir → ${stores.find((s) => s.id === csvStoreId)?.name ?? ''})`}
              </button>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
