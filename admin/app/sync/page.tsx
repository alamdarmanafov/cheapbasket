'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart2, Bell, BrainCircuit, MapPin, Play, Plus, RefreshCw, Search, Tag, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Store, db, slugify } from '@/lib/supabase';

interface Result { ok: boolean; venue?: string; found: number; matched: number; created: number; updated: number; unchanged: number; pending?: number; photos?: number; error?: string; at: string }
interface Source { id: string; store_id: string; url: string; name: string | null; enabled: boolean; last_run_at: string | null; last_result: Result | null }
interface Alerts { enabled: boolean; plus_only: boolean; min_percent: number }
interface PriceSnap { product_id: string; store_id: string; price: number | null; discount_price: number | null }
interface Anomaly { product_id: string; store_id: string; storeName: string; oldPrice: number; newPrice: number; changePct: number; flagged: boolean }
interface NewDiscount { product_id: string; store_id: string; storeName: string; regularPrice: number; discountPrice: number; pct: number }
interface TrendRow { store_id: string; storeName: string; storeColor: string; avgPrice: number; discountCount: number; totalCount: number; lastSync: string | null }

export default function SyncPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [cron, setCron] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [aiMatchBusy, setAiMatchBusy] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Array<{ slug: string; name: string; address: string | null; lat: number | null; lng: number | null; url: string; online?: boolean; pick: boolean }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [alsoBranches, setAlsoBranches] = useState(true);
  const [autoProgress, setAutoProgress] = useState<Array<{ storeId: string; name: string; status: 'pending' | 'loading' | 'done' | 'error'; count?: number; error?: string }>>([]);

  // Per-row test status
  type TestState = { loading?: boolean; ok?: boolean; found?: number; venue?: string; error?: string };
  const [testStatus, setTestStatus] = useState<Record<string, TestState>>({});
  const [testingAll, setTestingAll] = useState(false);

  // Price anomaly detection
  const priceSnapshot = useRef<PriceSnap[]>([]);
  const syncStartRef = useRef<string>(new Date().toISOString());
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // New discount detection
  const [newDiscounts, setNewDiscounts] = useState<NewDiscount[]>([]);
  const [showDiscounts, setShowDiscounts] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);

  // Market trends
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const search = async () => {
    if (q.trim().length < 2) return;
    setSearching(true);
    setFound(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/import/wolt/venues?q=${encodeURIComponent(q.trim())}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const existing = new Set(sources.map((s) => s.url));
      setFound(j.venues.map((v: { url: string }) => ({ ...v, pick: !existing.has(v.url) })));
      setMsg({ ok: true, text: `${j.venues.length} Wolt səhifəsi tapıldı. Marketi seç, lazım olanları işarələ və "Seçilənləri əlavə et".` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSearching(false);
    }
  };

  const addFound = async () => {
    if (!found || !storeId) return;
    const picks = found.filter((v) => v.pick);
    if (!picks.length) return;
    setBusy('addfound');
    let added = 0;
    let branches = 0;
    try {
      for (const v of picks) {
        await api({ op: 'add', store_id: storeId, url: v.url });
        added++;
        if (alsoBranches && v.lat != null && v.lng != null) {
          const id = slugify(`${storeId} ${v.slug}`);
          await db.upsert('branches', [{ id, store_id: storeId, name: v.name, address: v.address ?? v.name, lat: v.lat, lng: v.lng, maps_url: `https://www.google.com/maps?q=${v.lat},${v.lng}`, open_from: '08:00', open_until: '23:00' }], 'id');
          branches++;
        }
      }
      setMsg({ ok: true, text: `${added} mənbə${alsoBranches ? ` və ${branches} filial` : ''} əlavə olundu → ${stores.find((s) => s.id === storeId)?.name}. İndi "Hamısını yenilə" ilə qiymətləri çək.` });
      setFound(null);
      setQ('');
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const api = async (body: unknown) => {
    const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await res.text();
    let j: Record<string, unknown> = {};
    try { j = JSON.parse(text); } catch { throw new Error(`Server xətası (${res.status})${text ? ': ' + text.slice(0, 120) : ''}`); }
    if (!res.ok) throw new Error(typeof j.error === 'string' ? j.error : `HTTP ${res.status}`);
    return j;
  };

  const load = async () => {
    try {
      const [s, res] = await Promise.all([db.select<Store>('stores', { order: 'name' }), fetch('/api/sync')]);
      setStores(s);
      if (!storeId && s[0]) setStoreId(s[0].id);
      const text = await res.text();
      let r: Record<string, unknown> = {};
      try { r = JSON.parse(text); } catch { setMsg({ ok: false, text: `Server xətası (${res.status}): ${text.slice(0, 120)}` }); return; }
      if (r.error) setMsg({ ok: false, text: r.error as string });
      setSources((r.sources as Source[]) ?? []);
      setAlerts((r.alerts as Alerts) ?? null);
      setCron(!!r.cron);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!url.trim() || !storeId) return;
    setBusy('add');
    try { await api({ op: 'add', store_id: storeId, url }); setUrl(''); setMsg({ ok: true, text: 'Mənbə əlavə olundu. "İndi yenilə" ilə yoxla.' }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };

  const captureSnapshot = async () => {
    try {
      const snap = await db.select<PriceSnap>('prices', { columns: 'product_id,store_id,price,discount_price' });
      priceSnapshot.current = snap;
    } catch { /* ignore */ }
  };

  const detectAnomalies = async (storeMap: Map<string, string>) => {
    try {
      const after = await db.select<PriceSnap>('prices', { columns: 'product_id,store_id,price,discount_price' });
      const beforeMap = new Map(priceSnapshot.current.map((p) => [`${p.product_id}:${p.store_id}`, p]));
      const found: Anomaly[] = [];
      for (const p of after) {
        const key = `${p.product_id}:${p.store_id}`;
        const before = beforeMap.get(key);
        if (!before) continue;
        const oldEff = before.discount_price != null && before.discount_price < (before.price ?? Infinity) ? before.discount_price : before.price;
        const newEff = p.discount_price != null && p.discount_price < (p.price ?? Infinity) ? p.discount_price : p.price;
        if (oldEff == null || newEff == null || oldEff === 0) continue;
        const changePct = ((newEff - oldEff) / oldEff) * 100;
        if (changePct > 50 || changePct < -60) {
          found.push({
            product_id: p.product_id,
            store_id: p.store_id,
            storeName: storeMap.get(p.store_id) ?? p.store_id,
            oldPrice: oldEff,
            newPrice: newEff,
            changePct,
            flagged: false,
          });
        }
      }
      setAnomalies(found);
      if (found.length > 0) setShowAnalysis(true);
    } catch { /* ignore */ }
  };

  const detectDiscounts = async (storeMap: Map<string, string>) => {
    try {
      const after = await db.select<PriceSnap>('prices', { columns: 'product_id,store_id,price,discount_price' });
      const beforeMap = new Map(priceSnapshot.current.map((p) => [`${p.product_id}:${p.store_id}`, p]));
      const found: NewDiscount[] = [];
      for (const p of after) {
        if (p.discount_price == null) continue; // not discounted after sync
        const key = `${p.product_id}:${p.store_id}`;
        const before = beforeMap.get(key);
        if (!before || before.discount_price != null) continue; // not a new discount
        const regularPrice = p.price ?? 0;
        const discountPrice = p.discount_price;
        if (regularPrice <= 0 || discountPrice >= regularPrice) continue;
        const pct = ((regularPrice - discountPrice) / regularPrice) * 100;
        found.push({ product_id: p.product_id, store_id: p.store_id, storeName: storeMap.get(p.store_id) ?? p.store_id, regularPrice, discountPrice, pct });
      }
      setNewDiscounts(found);
      if (found.length > 0) setShowDiscounts(true);
    } catch { /* ignore */ }
  };

  const sendDiscountAlert = async () => {
    setAlertBusy(true);
    try {
      const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ since: syncStartRef.current }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: `Bildiriş göndərildi: ${j.users ?? 0} istifadəçi, ${j.sent ?? 0} cihaz.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAlertBusy(false);
    }
  };

  const runAiMatch = async () => {
    setAiMatchBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/ai/match-pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit: 50 }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: `AI eşləşdirməsi: ${j.processed} işləndi · ${j.matched} uyğun tapıldı · ${j.review} nəzərdən keçirilməlidir · ${j.rejected} uyğun tapılmadı` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAiMatchBusy(false);
    }
  };

  const run = async (id?: string) => {
    setBusy(id ?? 'all');
    setMsg(null);
    syncStartRef.current = new Date().toISOString();
    await captureSnapshot();
    try {
      const r = (await api({ op: 'run', id })) as { results: Array<Result & { store_id: string }>; alerts: { users: number; sent: number } | null };
      const upd = r.results.reduce((a, x) => a + x.updated, 0);
      const pend = r.results.reduce((a, x) => a + (x.pending ?? 0), 0);
      const bad = r.results.filter((x) => !x.ok);
      setMsg({ ok: bad.length === 0, text: `${r.results.length} mənbə yoxlanıldı · ${upd} qiymət dəyişdi${pend ? ` · ${pend} məhsul növbəyə əlavə edildi` : ''}${r.alerts ? ` · ${r.alerts.users} istifadəçiyə bildiriş (${r.alerts.sent} cihaz)` : ''}${bad.length ? ` · xəta: ${bad.map((b) => b.error).join('; ')}` : ''}` });
      const storeMap = new Map(stores.map((s) => [s.id, s.name]));
      await detectAnomalies(storeMap);
      await detectDiscounts(storeMap);
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };

  const remove = async (s: Source) => { if (!confirm('Mənbə silinsin? (məhsullar və qiymətlər qalır)')) return; await api({ op: 'delete', id: s.id }).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const toggle = async (s: Source) => { await api({ op: 'toggle', id: s.id, enabled: !s.enabled }).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const saveAlerts = async () => { if (!alerts) return; await api({ op: 'alerts', value: alerts }).then(() => setMsg({ ok: true, text: 'Bildiriş ayarları saxlanıldı' })).catch((e: Error) => setMsg({ ok: false, text: e.message })); };

  const testRow = async (id: string) => {
    setTestStatus((prev) => ({ ...prev, [id]: { loading: true } }));
    try {
      const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'test', id }) });
      const j = (await res.json()) as { ok: boolean; found?: number; venue?: string; error?: string };
      setTestStatus((prev) => ({ ...prev, [id]: { ok: j.ok, found: j.found, venue: j.venue, error: j.error } }));
    } catch (e) {
      setTestStatus((prev) => ({ ...prev, [id]: { ok: false, error: (e as Error).message } }));
    }
  };

  const testAll = async () => {
    const enabled = sources.filter((s) => s.enabled);
    if (!enabled.length) return;
    setTestingAll(true);
    for (const s of enabled) {
      await testRow(s.id);
    }
    setTestingAll(false);
  };
  const store = (id: string) => stores.find((s) => s.id === id);

  const autoSetup = async () => {
    const unconfigured = stores.filter((s) => !sources.some((src) => src.store_id === s.id));
    if (!unconfigured.length) { setMsg({ ok: true, text: 'Bütün marketlər üçün artıq mənbə var.' }); return; }
    setBusy('auto');
    setMsg(null);
    setAutoProgress(unconfigured.map((s) => ({ storeId: s.id, name: s.name, status: 'pending' })));
    let added = 0;
    for (let i = 0; i < unconfigured.length; i++) {
      const s = unconfigured[i];
      setAutoProgress((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'loading' } : p));
      try {
        const res = await fetch(`/api/import/wolt/venues?q=${encodeURIComponent(s.name)}`);
        const j = await res.json();
        if (!res.ok || !j.venues?.length) throw new Error(j.error ?? 'Wolt-da tapılmadı');
        const venue = j.venues.find((v: { online?: boolean }) => v.online !== false) ?? j.venues[0];
        await api({ op: 'add', store_id: s.id, url: venue.url });
        added++;
        if (alsoBranches && venue.lat != null && venue.lng != null) {
          await db.upsert('branches', [{ id: slugify(`${s.id} ${venue.slug}`), store_id: s.id, name: venue.name, address: venue.address ?? venue.name, lat: venue.lat, lng: venue.lng, maps_url: `https://www.google.com/maps?q=${venue.lat},${venue.lng}`, open_from: '08:00', open_until: '23:00' }], 'id');
        }
        setAutoProgress((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'done', count: 1 } : p));
      } catch (e) {
        setAutoProgress((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'error', error: (e as Error).message } : p));
      }
    }
    setMsg({ ok: true, text: `${added}/${unconfigured.length} market üçün Wolt mənbəsi tapıldı. İndi "Hamısını yenilə" ilə qiymətləri çək.` });
    load();
    setBusy(null);
  };

  const loadTrends = async () => {
    setTrendsLoading(true);
    try {
      const [prices, storeList] = await Promise.all([
        db.select<{ store_id: string; price: number | null; discount_price: number | null }>('prices', { columns: 'store_id,price,discount_price' }),
        db.select<Store>('stores', { columns: 'id,name,color' }),
      ]);
      const storeMap = new Map(storeList.map((s) => [s.id, s]));
      const grouped = new Map<string, { prices: number[]; discounts: number }>();
      for (const p of prices) {
        if (!grouped.has(p.store_id)) grouped.set(p.store_id, { prices: [], discounts: 0 });
        const g = grouped.get(p.store_id)!;
        const eff = p.discount_price != null && p.discount_price < (p.price ?? Infinity) ? p.discount_price : p.price;
        if (eff != null) g.prices.push(eff);
        if (p.discount_price != null) g.discounts++;
      }
      const rows: TrendRow[] = [];
      for (const [sid, g] of grouped) {
        const s = storeMap.get(sid);
        const src = sources.find((x) => x.store_id === sid);
        rows.push({
          store_id: sid,
          storeName: s?.name ?? sid,
          storeColor: s?.color ?? '#999',
          avgPrice: g.prices.length ? g.prices.reduce((a, b) => a + b, 0) / g.prices.length : 0,
          discountCount: g.discounts,
          totalCount: g.prices.length,
          lastSync: src?.last_run_at ?? null,
        });
      }
      rows.sort((a, b) => a.storeName.localeCompare(b.storeName));
      setTrends(rows);
    } catch { /* ignore */ } finally {
      setTrendsLoading(false);
    }
  };

  return (
    <Shell title="Avtomatik yeniləmə">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <h2><RefreshCw size={18} style={{ verticalAlign: -3 }} /> Wolt mənbələri</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Hər market üçün Wolt səhifəsini bir dəfə yadda saxla. "Hamısını yenilə" bütün mənbələri oxuyur və <b>yalnız bazada olan məhsulların</b> qiymətini (adi + endirim) yeniləyir; yeni məhsul yaratmır.
          {' '}<span className={`pill ${cron ? 'green' : 'red'}`}>{cron ? 'Avtomatik: hər bazar ertəsi 08:00 (Bakı)' : 'CRON_SECRET yoxdur — avtomatik işləmir'}</span>
        </p>
        {stores.some((s) => !sources.some((src) => src.store_id === s.id)) && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#166534' }}>
                <b>{stores.filter((s) => !sources.some((src) => src.store_id === s.id)).length} market</b> üçün hələ Wolt mənbəsi yoxdur.
              </span>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={alsoBranches} onChange={(e) => setAlsoBranches(e.target.checked)} style={{ width: 'auto' }} /> Filial kimi də qeyd et
              </label>
              <button className="btn" disabled={busy === 'auto'} onClick={autoSetup}>
                <RefreshCw size={14} style={busy === 'auto' ? { animation: 'spin 1s linear infinite' } : {}} /> {busy === 'auto' ? 'Axtarılır…' : 'Bütün marketlər üçün avtomatik tap'}
              </button>
            </div>
            {autoProgress.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {autoProgress.map((p) => (
                  <span key={p.storeId} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: p.status === 'done' ? '#16A34A' : p.status === 'error' ? '#DC2626' : p.status === 'loading' ? '#2563EB' : '#9CA3AF', flexShrink: 0, display: 'inline-block' }} />
                    {p.name}{p.status === 'error' ? ` ✗` : p.status === 'done' ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="toolbar" style={{ background: '#FAFAFA', padding: 12, borderRadius: 12 }}>
          <Search size={16} className="muted" />
          <input placeholder="Wolt-da market axtar: Araz, Bravo, Bazarstore, Neptun…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
          <button className="btn secondary" disabled={searching || q.trim().length < 2} onClick={search}>{searching ? 'Axtarılır…' : 'Wolt-da axtar'}</button>
        </div>
        {found && (
          <div style={{ marginBottom: 14 }}>
            <div className="toolbar">
              <span className="muted">Hansı marketə:</span>
              <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ flex: 'none' }}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={alsoBranches} onChange={(e) => setAlsoBranches(e.target.checked)} style={{ width: 'auto' }} /> Filial kimi də əlavə et (ad, ünvan, koordinat)</label>
              <button className="btn ghost" onClick={() => setFound(found.map((v) => ({ ...v, pick: true })))}>Hamısını seç</button>
              <button className="btn" disabled={busy === 'addfound' || !found.some((v) => v.pick)} onClick={addFound}><Plus size={14} /> Seçilənləri əlavə et ({found.filter((v) => v.pick).length})</button>
            </div>
            <table>
              <thead><tr><th></th><th>Wolt adı</th><th>Ünvan</th><th>Koordinat</th><th>Status</th></tr></thead>
              <tbody>
                {found.map((v) => (
                  <tr key={v.slug}>
                    <td><input type="checkbox" checked={v.pick} onChange={(e) => setFound(found.map((x) => (x.slug === v.slug ? { ...x, pick: e.target.checked } : x)))} /></td>
                    <td><a href={v.url} target="_blank" rel="noreferrer">{v.name}</a></td>
                    <td className="muted" style={{ fontSize: 12 }}>{v.address ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{v.lat != null && v.lng != null ? <a href={`https://www.google.com/maps?q=${v.lat},${v.lng}`} target="_blank" rel="noreferrer"><MapPin size={12} style={{ verticalAlign: -2 }} /> {v.lat.toFixed(4)}, {v.lng.toFixed(4)}</a> : '—'}</td>
                    <td>{sources.some((s) => s.url === v.url) ? <span className="pill gray">artıq mənbədir</span> : v.online === false ? <span className="pill red">bağlıdır</span> : <span className="pill green">yeni</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="toolbar">
          <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input placeholder="və ya linki yapışdır: Wolt venue / istənilən market saytının kateqoriya səhifəsi" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn secondary" disabled={busy === 'add' || !url.trim()} onClick={add}><Plus size={14} /> Mənbə əlavə et</button>
          <button className="btn" disabled={!!busy || !sources.length} onClick={() => run()}><Play size={14} /> {busy === 'all' ? 'Yenilənir…' : 'Hamısını yenilə'}</button>
          <button className="btn secondary" disabled={testingAll || !sources.some((s) => s.enabled)} onClick={testAll}>
            <RefreshCw size={14} style={testingAll ? { animation: 'spin 1s linear infinite' } : {}} /> {testingAll ? 'Test edilir…' : 'Hamısını test et'}
          </button>
          <button className="btn secondary" disabled={aiMatchBusy} onClick={runAiMatch} title="Növbədəki uyğunsuz məhsullar üçün AI eşləşdirməsi işlət (50 ədəd)">
            <BrainCircuit size={14} style={aiMatchBusy ? { animation: 'spin 1s linear infinite' } : {}} /> {aiMatchBusy ? 'AI işləyir…' : 'AI eşləşdirmə'}
          </button>
        </div>
        <table>
          <thead><tr><th>Market</th><th>Wolt səhifəsi</th><th>Son yeniləmə</th><th>Nəticə</th><th>Aktiv</th><th>Test</th><th></th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={{ opacity: s.enabled ? 1 : 0.55 }}>
                <td><span className="avatar" style={{ background: store(s.store_id)?.color ?? '#999' }}>{store(s.store_id)?.initial}</span>{store(s.store_id)?.name ?? s.store_id}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={s.url} target="_blank" rel="noreferrer">{s.name || s.url.replace(/^https?:\/\/(www\.)?/, '')}</a></td>
                <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.last_run_at ? new Date(s.last_run_at).toLocaleString('az-AZ') : '—'}</td>
                <td style={{ fontSize: 12 }}>
                  {!s.last_result ? <span className="muted">hələ işləməyib</span> : s.last_result.ok
                    ? <span>{s.last_result.found} məhsul · {s.last_result.matched} uyğun{s.last_result.pending ? <> · <b style={{ color: '#D97706' }}>{s.last_result.pending} növbədə</b></> : null}{s.last_result.created ? <> · <b style={{ color: '#2563EB' }}>{s.last_result.created} yaradıldı</b></> : null} · <b style={{ color: s.last_result.updated ? '#16A34A' : undefined }}>{s.last_result.updated} dəyişdi</b>{s.last_result.photos ? ` · ${s.last_result.photos} şəkil` : ''}</span>
                    : <span className="pill red" title={s.last_result.error}>xəta: {s.last_result.error?.slice(0, 60)}</span>}
                </td>
                <td><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /></td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {testStatus[s.id]?.loading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Yoxlanır…
                    </span>
                  ) : testStatus[s.id]?.ok === true ? (
                    <span style={{ color: '#16A34A' }}>✓ {testStatus[s.id].found} məhsul tapıldı</span>
                  ) : testStatus[s.id]?.ok === false ? (
                    <span style={{ color: '#DC2626' }} title={testStatus[s.id].error}>{testStatus[s.id].error?.slice(0, 50)}</span>
                  ) : null}
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn ghost" disabled={testingAll || testStatus[s.id]?.loading} onClick={() => testRow(s.id)}>{testStatus[s.id]?.loading ? '…' : 'Test et'}</button>
                  <button className="btn ghost" disabled={!!busy} onClick={() => run(s.id)}>{busy === s.id ? 'Yenilənir…' : 'İndi yenilə'}</button>
                  <button className="btn ghost" onClick={() => remove(s)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {sources.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>Mənbə yoxdur. Yuxarıdan market seçib Wolt linkini əlavə et (və ya "Wolt-dan import" səhifəsində importdan sonra "mənbəni yadda saxla").</td></tr>}
          </tbody>
        </table>
      </div>

      {alerts && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>🔻 Qiymət düşəndə dərhal bildiriş</h2>
          <p className="muted" style={{ marginTop: 0 }}>Qiymət (əl ilə, importla və ya avtomatik yeniləmə ilə) aşağı düşəndə həmin məhsulu səbətində saxlayan istifadəçilərə push gedir. Eyni düşüş üçün 24 saatda bir dəfə.</p>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={alerts.enabled} onChange={(e) => setAlerts({ ...alerts, enabled: e.target.checked })} /> Aktiv</label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={alerts.plus_only} onChange={(e) => setAlerts({ ...alerts, plus_only: e.target.checked })} /> Yalnız Plus istifadəçilərə</label>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>Min. düşüş <input type="number" min={0} max={90} value={alerts.min_percent} onChange={(e) => setAlerts({ ...alerts, min_percent: Number(e.target.value) })} style={{ width: 70 }} /> %</label>
            <button className="btn secondary" onClick={saveAlerts}>Saxla</button>
          </div>
        </div>
      )}

      {/* New Discounts Card */}
      {(newDiscounts.length > 0 || showDiscounts) && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0 }}><Tag size={18} style={{ verticalAlign: -3 }} /> Yeni endirimli məhsullar{newDiscounts.length > 0 ? ` (${newDiscounts.length})` : ''}</h2>
            <button className="btn secondary" onClick={() => setShowDiscounts(!showDiscounts)}>{showDiscounts ? 'Gizlət' : 'Göstər'}</button>
          </div>
          {showDiscounts && (
            <>
              <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>Son sinxronizasiyadan sonra endirim qiyməti əlavə olunmuş məhsullar (əvvəllər endirim yox idi).</p>
              {newDiscounts.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Yeni endirimlər aşkarlanmadı.</p>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Məhsul</th>
                          <th>Market</th>
                          <th style={{ textAlign: 'right' }}>Adi qiymət ₼</th>
                          <th style={{ textAlign: 'right' }}>Endirimli ₼</th>
                          <th style={{ textAlign: 'right' }}>Endirim %</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newDiscounts.map((d, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.product_id}</td>
                            <td>{d.storeName}</td>
                            <td style={{ textAlign: 'right', textDecoration: 'line-through', color: '#9CA3AF' }}>{d.regularPrice.toFixed(2)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#16A34A' }}>{d.discountPrice.toFixed(2)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="pill green">-{d.pct.toFixed(1)}%</span>
                            </td>
                            <td>
                              <button className="btn ghost" style={{ fontSize: 12 }} disabled={alertBusy} onClick={sendDiscountAlert}>
                                <Bell size={12} /> {alertBusy ? '…' : 'Bildiriş göndər'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn secondary" disabled={alertBusy} onClick={sendDiscountAlert}>
                      <Bell size={14} /> {alertBusy ? 'Göndərilir…' : `Hamısı üçün bildiriş göndər (${newDiscounts.length})`}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Price Analysis Card */}
      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}><BarChart2 size={18} style={{ verticalAlign: -3 }} /> Qiymət analizi</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn secondary" onClick={() => setShowAnalysis(!showAnalysis)}>{showAnalysis ? 'Gizlət' : 'Göstər'}</button>
            <button className="btn secondary" disabled={trendsLoading} onClick={loadTrends}>{trendsLoading ? 'Yüklənir…' : 'Trendi yenilə'}</button>
          </div>
        </div>

        {showAnalysis && (
          <>
            {/* Anomaly table */}
            {anomalies.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={16} style={{ color: '#D97706' }} /> Qiymət anomaliyaları ({anomalies.filter((a) => !a.flagged).length})
                </h3>
                <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Son sinxronizasiyadan sonra &gt;50% artım və ya &gt;60% düşüş olan məhsullar (mümkün məlumat xətası).</p>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Məhsul ID</th><th>Market</th><th style={{ textAlign: 'right' }}>Əvvəl ₼</th><th style={{ textAlign: 'right' }}>İndi ₼</th><th style={{ textAlign: 'right' }}>Dəyişim</th><th></th></tr>
                    </thead>
                    <tbody>
                      {anomalies.map((a, i) => (
                        <tr key={i} style={{ opacity: a.flagged ? 0.4 : 1 }}>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.product_id}</td>
                          <td>{a.storeName}</td>
                          <td style={{ textAlign: 'right' }}>{a.oldPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{a.newPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`pill ${a.changePct > 0 ? 'red' : 'green'}`}>
                              {a.changePct > 0 ? '+' : ''}{a.changePct.toFixed(1)}%
                            </span>
                          </td>
                          <td>
                            <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setAnomalies(anomalies.map((x, j) => j === i ? { ...x, flagged: !x.flagged } : x))}>
                              {a.flagged ? 'Geri al' : 'Bildir / Nəzərə alma'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {anomalies.length === 0 && (
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Anomaliya yoxdur. "Hamısını yenilə" işlədikdən sonra burada görünəcək.</p>
            )}

            {/* Market trends */}
            {trends.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 8 }}>Qiymət trendi — marketlər üzrə</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Market</th><th style={{ textAlign: 'right' }}>Orta qiymət ₼</th><th style={{ textAlign: 'right' }}>Endirimlilər</th><th style={{ textAlign: 'right' }}>Cəmi məhsul</th><th>Son sinxron</th></tr>
                    </thead>
                    <tbody>
                      {trends.map((t) => (
                        <tr key={t.store_id}>
                          <td>
                            <span className="avatar" style={{ background: t.storeColor }}>{t.storeName[0]}</span>
                            {t.storeName}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{t.avgPrice.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="pill green">{t.discountCount}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{t.totalCount}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{t.lastSync ? new Date(t.lastSync).toLocaleString('az-AZ') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {trends.length === 0 && (
              <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Trendi görmək üçün "Trendi yenilə" düyməsinə bas.</p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
