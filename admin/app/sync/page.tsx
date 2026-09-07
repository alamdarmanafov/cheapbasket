'use client';
import { useEffect, useState } from 'react';
import { MapPin, Play, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Store, db, slugify } from '@/lib/supabase';

interface Result { ok: boolean; venue?: string; found: number; matched: number; updated: number; unchanged: number; photos?: number; error?: string; at: string }
interface Source { id: string; store_id: string; url: string; name: string | null; enabled: boolean; last_run_at: string | null; last_result: Result | null }
interface Alerts { enabled: boolean; plus_only: boolean; min_percent: number }

export default function SyncPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [cron, setCron] = useState(false);
  const [storeId, setStoreId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Wolt venue search ("Araz" → every Araz on Wolt)
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Array<{ slug: string; name: string; address: string | null; lat: number | null; lng: number | null; url: string; online?: boolean; pick: boolean }> | null>(null);
  const [searching, setSearching] = useState(false);
  const [alsoBranches, setAlsoBranches] = useState(true);
  const [autoProgress, setAutoProgress] = useState<Array<{ storeId: string; name: string; status: 'pending' | 'loading' | 'done' | 'error'; count?: number; error?: string }>>([]);

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
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j;
  };
  const load = async () => {
    const [s, r] = await Promise.all([db.select<Store>('stores', { order: 'name' }), fetch('/api/sync').then((x) => x.json())]);
    setStores(s);
    if (!storeId && s[0]) setStoreId(s[0].id);
    if (r.error) setMsg({ ok: false, text: r.error });
    setSources(r.sources ?? []);
    setAlerts(r.alerts ?? null);
    setCron(!!r.cron);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async () => {
    if (!url.trim() || !storeId) return;
    setBusy('add');
    try { await api({ op: 'add', store_id: storeId, url }); setUrl(''); setMsg({ ok: true, text: 'Mənbə əlavə olundu. "İndi yenilə" ilə yoxla.' }); load(); } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };
  const run = async (id?: string) => {
    setBusy(id ?? 'all');
    setMsg(null);
    try {
      const r = (await api({ op: 'run', id })) as { results: Array<Result & { store_id: string }>; alerts: { users: number; sent: number } | null };
      const upd = r.results.reduce((a, x) => a + x.updated, 0);
      const bad = r.results.filter((x) => !x.ok);
      setMsg({ ok: bad.length === 0, text: `${r.results.length} mənbə yoxlanıldı · ${upd} qiymət dəyişdi${r.alerts ? ` · ${r.alerts.users} istifadəçiyə qiymət düşüşü bildirişi (${r.alerts.sent} cihaz)` : ''}${bad.length ? ` · xəta: ${bad.map((b) => b.error).join('; ')}` : ''}` });
      load();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(null); }
  };
  const remove = async (s: Source) => { if (!confirm('Mənbə silinsin? (məhsullar və qiymətlər qalır)')) return; await api({ op: 'delete', id: s.id }).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const toggle = async (s: Source) => { await api({ op: 'toggle', id: s.id, enabled: !s.enabled }).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const saveAlerts = async () => { if (!alerts) return; await api({ op: 'alerts', value: alerts }).then(() => setMsg({ ok: true, text: 'Bildiriş ayarları saxlanıldı' })).catch((e: Error) => setMsg({ ok: false, text: e.message })); };
  const store = (id: string) => stores.find((s) => s.id === id);

  /** Auto-find and add one Wolt source for every store that has no source yet. */
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

  return (
    <Shell title="Avtomatik yeniləmə">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <h2><RefreshCw size={18} style={{ verticalAlign: -3 }} /> Wolt mənbələri</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Hər market üçün Wolt səhifəsini bir dəfə yadda saxla. "Hamısını yenilə" bütün mənbələri oxuyur və <b>yalnız bazada olan məhsulların</b> qiymətini (adi + endirim) yeniləyir; yeni məhsul yaratmır.
          {' '}<span className={`pill ${cron ? 'green' : 'red'}`}>{cron ? 'Avtomatik: hər bazar ertəsi 08:00 (Bakı)' : 'CRON_SECRET yoxdur — avtomatik işləmir'}</span>
        </p>
        {/* One-click: auto-find a Wolt source for every store that has none */}
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
        </div>
        <table>
          <thead><tr><th>Market</th><th>Wolt səhifəsi</th><th>Son yeniləmə</th><th>Nəticə</th><th>Aktiv</th><th></th></tr></thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={{ opacity: s.enabled ? 1 : 0.55 }}>
                <td><span className="avatar" style={{ background: store(s.store_id)?.color ?? '#999' }}>{store(s.store_id)?.initial}</span>{store(s.store_id)?.name ?? s.store_id}</td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><a href={s.url} target="_blank" rel="noreferrer">{s.name || s.url.replace(/^https?:\/\/(www\.)?/, '')}</a></td>
                <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.last_run_at ? new Date(s.last_run_at).toLocaleString('az-AZ') : '—'}</td>
                <td style={{ fontSize: 12 }}>
                  {!s.last_result ? <span className="muted">hələ işləməyib</span> : s.last_result.ok
                    ? <span>{s.last_result.found} məhsul · {s.last_result.matched} uyğun · <b style={{ color: s.last_result.updated ? '#16A34A' : undefined }}>{s.last_result.updated} dəyişdi</b>{s.last_result.photos ? ` · ${s.last_result.photos} şəkil` : ''}</span>
                    : <span className="pill red" title={s.last_result.error}>xəta: {s.last_result.error?.slice(0, 60)}</span>}
                </td>
                <td><input type="checkbox" checked={s.enabled} onChange={() => toggle(s)} /></td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn ghost" disabled={!!busy} onClick={() => run(s.id)}>{busy === s.id ? 'Yenilənir…' : 'İndi yenilə'}</button>
                  <button className="btn ghost" onClick={() => remove(s)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {sources.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>Mənbə yoxdur. Yuxarıdan market seçib Wolt linkini əlavə et (və ya "Wolt-dan import" səhifəsində importdan sonra "mənbəni yadda saxla").</td></tr>}
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
    </Shell>
  );
}
