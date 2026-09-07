'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { CATEGORIES, Product, Store, db, slugify } from '@/lib/supabase';
import { mapCategory, splitName, type WoltItem, type WoltResult } from '@/lib/wolt';

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Product[]>([]);

  useEffect(() => {
    db.select<Store>('stores', { order: 'name' }).then((s) => { setStores(s); if (s[0]) setStoreId(s[0].id); }).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category' }).then(setExisting).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    setResult(null);
    setRows([]);
    try {
      const res = await fetch('/api/import/wolt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const j = (await res.json()) as WoltResult & { error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const byBarcode = new Map(existing.filter((p) => p.barcode).map((p) => [p.barcode as string, p.id]));
      setResult(j);
      setRows(
        j.items.map((it) => {
          const sp = splitName(it.name);
          return {
            ...it,
            key: it.ext_id,
            selected: it.price != null,
            appCategory: mapCategory(it.category, it.name, CATEGORIES),
            existingId: it.barcode ? byBarcode.get(it.barcode) ?? null : null,
            brand: sp.brand,
            title: sp.name,
            size: sp.size,
            priceText: it.regular_price != null ? it.regular_price.toFixed(2) : it.price != null ? it.price.toFixed(2) : '',
            discountText: it.regular_price != null && it.price != null ? it.price.toFixed(2) : '',
          };
        }),
      );
      setMsg({ ok: true, text: `${j.items.length} məhsul tapıldı${j.venue ? ` · ${j.venue}` : ''}. ${j.items.filter((i) => i.regular_price != null).length} endirimli.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (!n || r.name.toLowerCase().includes(n) || (r.barcode ?? '').includes(n)) && (!cat || r.category === cat) && (!onlyDiscount || r.regular_price != null));
  }, [rows, q, cat, onlyDiscount]);

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const valid = (r: Row) => {
    const p = num(r.priceText);
    const d = num(r.discountText);
    return p != null && !Number.isNaN(p) && p > 0 && (d == null || (!Number.isNaN(d) && d > 0 && d < p)) && r.title.trim() !== '';
  };
  const selected = rows.filter((r) => r.selected && valid(r));
  const setAll = (v: boolean) => setRows(rows.map((r) => (filtered.includes(r) ? { ...r, selected: v && valid(r) } : r)));
  const patch = (key: string, p: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const importSelected = async () => {
    if (!storeId) { setMsg({ ok: false, text: 'Əvvəlcə market seç.' }); return; }
    setBusy(true);
    setMsg(null);
    try {
      const products: Record<string, unknown>[] = [];
      const prices: Record<string, unknown>[] = [];
      const now = new Date().toISOString();
      const usedIds = new Set<string>();
      for (const r of selected) {
        let id = r.existingId ?? r.barcode ?? `wolt-${slugify(r.name)}`;
        if (!r.existingId && usedIds.has(id)) id = `${id}-${r.ext_id.slice(-4)}`;
        usedIds.add(id);
        if (!r.existingId) {
          products.push({ id, barcode: r.barcode, name: r.title.trim(), brand: r.brand.trim(), size: r.size.trim() || '—', category: r.appCategory, emoji: '🛒', tint: '#F3F4F6', image_url: r.image_url });
        }
        prices.push({ product_id: id, store_id: storeId, price: num(r.priceText), discount_price: num(r.discountText), updated_at: now });
      }
      for (let i = 0; i < products.length; i += 200) await db.upsert('products', products.slice(i, i + 200), 'id');
      for (let i = 0; i < prices.length; i += 200) await db.upsert('prices', prices.slice(i, i + 200), 'product_id,store_id');
      setMsg({ ok: true, text: `${prices.length} qiymət yazıldı (${products.length} yeni məhsul, ${prices.length - products.length} mövcud məhsul yeniləndi) → ${stores.find((s) => s.id === storeId)?.name}` });
      const ex = await db.select<Product>('products', { columns: 'id, barcode, name, brand, size, category' });
      setExisting(ex);
      const byBarcode = new Map(ex.filter((p) => p.barcode).map((p) => [p.barcode as string, p.id]));
      setRows(rows.map((r) => ({ ...r, existingId: r.barcode ? byBarcode.get(r.barcode) ?? r.existingId : r.existingId })));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Wolt-dan import">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <input placeholder="https://wolt.com/az/aze/baku/venue/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} title="Qiymətlər hansı marketə yazılsın">
          {stores.length === 0 && <option value="">Market yoxdur</option>}
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn secondary" disabled={loading || !url} onClick={load}><Download size={14} /> {loading ? 'Yüklənir…' : 'Məhsulları çək'}</button>
        <button className="btn" disabled={!selected.length || busy || !storeId} onClick={importSelected}>{busy ? 'Yazılır…' : `Seçilənləri import et (${selected.length})`}</button>
      </div>
      <p className="note">
        Wolt venue linkini yapışdır, məhsullar adi və endirimli qiymətlə çəkilir. Soldakı siyahıdan hansı marketə yazılacağını seç (məs. Wolt Market özü ayrıca market kimi "Marketlər" səhifəsində əlavə oluna bilər, Araz/Bravo filialının Wolt səhifəsi isə həmin markete yazılır).
        Yazmazdan əvvəl brend, ad, ölçü, kateqoriya və qiymətləri cədvəldə düzəldə bilərsən. Barkodu bazada olan məhsul təkrar yaradılmır (ad dəyişmir), yalnız qiyməti yenilənir. Wolt qiymətləri mağaza rəfindəki qiymətdən fərqlənə bilər.
      </p>

      {rows.length > 0 && (
        <>
          <div className="toolbar" style={{ marginTop: 14 }}>
            <Search size={16} className="muted" />
            <input placeholder="Ad və ya barkod…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Bütün kateqoriyalar ({rows.length})</option>
              {result?.categories.map((c) => <option key={c} value={c}>{c} ({rows.filter((r) => r.category === c).length})</option>)}
            </select>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={onlyDiscount} onChange={(e) => setOnlyDiscount(e.target.checked)} /> Yalnız endirimlilər</label>
            <button className="btn ghost" onClick={() => setAll(true)}>Hamısını seç</button>
            <button className="btn ghost" onClick={() => setAll(false)}>Seçimi sil</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th></th><th>Wolt adı</th><th>Brend</th><th>Ad</th><th>Ölçü</th><th>Kateqoriya</th><th>Barkod</th><th style={{ textAlign: 'right' }}>Adi ₼</th><th style={{ textAlign: 'right' }}>Endirim ₼</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r) => (
                  <tr key={r.key} style={{ opacity: valid(r) ? 1 : 0.6, background: r.selected ? '#FFF7F7' : undefined }}>
                    <td><input type="checkbox" checked={r.selected} disabled={!valid(r)} onChange={(e) => patch(r.key, { selected: e.target.checked })} /></td>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 260 }}>
                      {r.image_url ? <img src={r.image_url} alt="" width={32} height={32} style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 32, flexShrink: 0 }} />}
                      <span style={{ fontSize: 12 }} title={r.category ?? ''}>{r.name}{r.category ? <span className="muted"> · {r.category}</span> : null}</span>
                    </td>
                    <td><input value={r.brand} placeholder="Brend" style={{ width: 90 }} onChange={(e) => patch(r.key, { brand: e.target.value })} disabled={!!r.existingId} /></td>
                    <td><input value={r.title} placeholder="Ad" style={{ width: 160 }} onChange={(e) => patch(r.key, { title: e.target.value })} disabled={!!r.existingId} /></td>
                    <td><input value={r.size} placeholder="1 L" style={{ width: 64 }} onChange={(e) => patch(r.key, { size: e.target.value })} disabled={!!r.existingId} /></td>
                    <td><select value={r.appCategory} onChange={(e) => patch(r.key, { appCategory: e.target.value })} disabled={!!r.existingId}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></td>
                    <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.barcode ?? '—'}</td>
                    <td><input inputMode="decimal" value={r.priceText} placeholder="—" style={{ width: 64, textAlign: 'right', textDecoration: r.discountText ? 'line-through' : undefined, color: r.discountText ? '#9CA3AF' : undefined }} onChange={(e) => patch(r.key, { priceText: e.target.value })} /></td>
                    <td><input inputMode="decimal" value={r.discountText} placeholder="endirim" style={{ width: 64, textAlign: 'right', color: '#16A34A', fontWeight: 600 }} onChange={(e) => patch(r.key, { discountText: e.target.value })} /></td>
                    <td>{r.existingId ? <span className="pill gray" title={`Mövcud məhsul: ${r.existingId}`}>bazada var</span> : <span className="pill green">yeni</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length > 500 && <p className="note">İlk 500 sətir göstərilir, axtarış və ya kateqoriya ilə daralt (seçim bütün siyahıya tətbiq olunur).</p>}
          {result && <p className="note">Mənbə: {result.debug.endpoint}</p>}
        </>
      )}
    </Shell>
  );
}
