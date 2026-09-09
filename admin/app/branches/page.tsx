'use client';
import { useEffect, useRef, useState } from 'react';
import { Clock, FileSpreadsheet, Map, MapPin, Plus, RefreshCw, Search, Table, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { BranchImport, branchId } from '@/components/BranchImport';
import { Branch, Store, db } from '@/lib/supabase';
import type { WoltVenue } from '@/lib/wolt';

declare global {
  interface Window {
    __branchEdit?: (id: string) => void;
    __branchDel?: (id: string) => void;
    __branchMapClick?: (lat: number, lng: number) => void;
  }
}

type BulkStatus = { storeId: string; name: string; status: 'pending' | 'loading' | 'done' | 'error'; count?: number; error?: string };
type ViewMode = 'table' | 'map';

export default function Branches() {
  const [stores, setStores] = useState<Store[]>([]);
  const [rows, setRows] = useState<Branch[]>([]);
  const [edit, setEdit] = useState<Branch | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resolving, setResolving] = useState(false);

  // View toggle
  const [view, setView] = useState<ViewMode>('table');

  // Leaflet map state
  const [leafletReady, setLeafletReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  // Wolt import panel
  const [woltOpen, setWoltOpen] = useState(false);
  // Bulk auto-import (all stores)
  const [bulk, setBulk] = useState<BulkStatus[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  // Manual single-store search
  const [woltQuery, setWoltQuery] = useState('');
  const [woltStoreId, setWoltStoreId] = useState('');
  const [woltLoading, setWoltLoading] = useState(false);
  const [woltVenues, setWoltVenues] = useState<WoltVenue[]>([]);
  const [woltSelected, setWoltSelected] = useState<Set<string>>(new Set());
  const [woltError, setWoltError] = useState('');
  const [woltImporting, setWoltImporting] = useState(false);

  // Bulk hours
  const [bulkHoursOpen, setBulkHoursOpen] = useState(false);
  const [bulkHoursStoreId, setBulkHoursStoreId] = useState('');
  const [bulkHoursApplying, setBulkHoursApplying] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  /** Row selection for bulk delete, and the store filter it works within. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [storeFilter, setStoreFilter] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Wolt name autosuggest (in edit form)
  const [woltSuggestVenues, setWoltSuggestVenues] = useState<WoltVenue[]>([]);
  const [woltSuggestLoading, setWoltSuggestLoading] = useState(false);
  const woltSuggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Google Maps quick-parse in form

  // Wolt hours fetch in form
  const [woltEditSlug, setWoltEditSlug] = useState('');
  const [woltHoursFetching, setWoltHoursFetching] = useState(false);

  // ── Leaflet loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).L) { setLeafletReady(true); return; }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    } else {
      // script tag already exists (e.g. HMR), wait for load
      const existing = document.getElementById('leaflet-js') as HTMLScriptElement;
      if (existing.dataset.loaded === '1') setLeafletReady(true);
      else existing.addEventListener('load', () => setLeafletReady(true), { once: true });
    }
  }, []);

  // ── Leaflet map init/update ──────────────────────────────────────────────────

  useEffect(() => {
    if (!leafletReady || view !== 'map' || !mapContainerRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as any).L as any;

    // Destroy existing instance before re-creating
    if (mapInstanceRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapInstanceRef.current as any).remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current).setView([40.4093, 49.8671], 12);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    rows.forEach((b) => {
      const store = stores.find((s) => s.id === b.store_id);
      const color = store?.color ?? '#64748B';
      const marker = L.circleMarker([b.lat, b.lng], {
        radius: 9,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      });
      const is24 = b.open_from === '00:00' && b.open_until === '23:59';
      const hours = is24 ? '24 saat' : (b.open_from || b.open_until) ? `${b.open_from ?? '…'}–${b.open_until ?? '…'}` : '—';
      const popup = L.popup({ minWidth: 200 }).setContent(`
        <div style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">
          <div style="font-weight:700;margin-bottom:2px">${escHtml(b.name)}</div>
          <div style="color:#64748B;font-size:12px;margin-bottom:2px">${escHtml(b.address)}</div>
          ${b.phone ? `<div style="font-size:12px">${escHtml(b.phone)}</div>` : ''}
          <div style="font-size:12px;color:#475569">${escHtml(hours)}</div>
          <div style="margin-top:8px;display:flex;gap:6px">
            <button data-edit="${b.id}" style="font-size:12px;padding:3px 10px;cursor:pointer;border:1px solid #CBD5E1;border-radius:5px;background:#fff">Düzəlt</button>
            <button data-del="${b.id}" style="font-size:12px;padding:3px 10px;cursor:pointer;border:1px solid #FCA5A5;border-radius:5px;background:#FEF2F2;color:#DC2626">Sil</button>
          </div>
        </div>
      `);
      popup.on('add', () => {
        const el = popup.getElement();
        if (!el) return;
        el.querySelector('[data-edit]')?.addEventListener('click', () => {
          map.closePopup();
          window.__branchEdit?.(b.id);
        });
        el.querySelector('[data-del]')?.addEventListener('click', () => {
          map.closePopup();
          window.__branchDel?.(b.id);
        });
      });
      marker.bindPopup(popup).addTo(map);
    });

    // Click on empty map to pre-fill coords for a new branch
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      window.__branchMapClick?.(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).remove();
      mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletReady, view, rows, stores]);

  // ── Register global map callbacks (updated every render so they close over fresh state) ──

  useEffect(() => {
    window.__branchEdit = (id: string) => {
      const b = rows.find((r) => r.id === id);
      if (b) { setWoltSuggestVenues([]); setWoltEditSlug(''); setEdit(b); }
    };
    window.__branchDel = (id: string) => {
      const b = rows.find((r) => r.id === id);
      if (b) remove(b);
    };
    window.__branchMapClick = (lat: number, lng: number) => {
      setWoltSuggestVenues([]); setWoltEditSlug('');
      setEdit({ id: '', store_id: stores[0]?.id ?? '', name: '', address: '', lat, lng, ...storeHours(stores[0]?.id ?? ''), maps_url: '', phone: '' });
    };
  });

  // ── Data helpers ─────────────────────────────────────────────────────────────

  const fetchVenues = async (q: string): Promise<WoltVenue[]> => {
    const res = await fetch(`/api/import/wolt/venues?q=${encodeURIComponent(q)}`);
    const j = await res.json() as { venues?: WoltVenue[]; error?: string };
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j.venues ?? [];
  };

  const upsertBranches = (storeId: string, venues: WoltVenue[]) => {
    const branchRows: Branch[] = venues.filter((v) => v.lat != null && v.lng != null).map((v) => ({
      id: branchId(storeId, v.name),
      store_id: storeId,
      name: v.name,
      address: v.address ?? '',
      lat: v.lat!,
      lng: v.lng!,
      open_until: v.open_until ?? null,
      open_from: v.open_from ?? null,
      maps_url: v.url ?? null,
      phone: null,
    }));
    return db.upsert('branches', branchRows as unknown as Record<string, unknown>[]).then(() => branchRows.length);
  };

  /** Auto-import all stores via server-side route (handles search + venue detail + upsert). */
  const importAll = async () => {
    if (!stores.length || bulkRunning) return;
    setBulkRunning(true);
    setBulk(stores.map((s) => ({ storeId: s.id, name: s.name, status: 'loading' as const })));
    try {
      const res = await fetch('/api/import/wolt/branches', { method: 'POST' });
      const j = await res.json() as { results?: Array<{ store: string; found: number; upserted: number; error?: string }>; total?: number };
      if (!res.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      const r = j.results ?? [];
      setBulk(stores.map((s) => {
        const match = r.find((x) => x.store === s.name);
        if (!match) return { storeId: s.id, name: s.name, status: 'pending' as const };
        return match.error
          ? { storeId: s.id, name: s.name, status: 'error' as const, error: match.error }
          : { storeId: s.id, name: s.name, status: 'done' as const, count: match.upserted };
      }));
      setMsg({ ok: true, text: `Wolt avtomatik import tamamlandı — ${j.total ?? 0} filial əlavə edildi` });
      load();
    } catch (e) {
      setBulk((prev) => prev.map((b) => ({ ...b, status: 'error' as const, error: (e as Error).message })));
      setMsg({ ok: false, text: (e as Error).message });
    }
    setBulkRunning(false);
  };

  const searchWolt = async (query?: string, sid?: string) => {
    const q = (query ?? woltQuery).trim();
    if (!q || !(sid ?? woltStoreId)) return;
    setWoltLoading(true);
    setWoltError('');
    setWoltVenues([]);
    setWoltSelected(new Set());
    try {
      const venues = await fetchVenues(q);
      setWoltVenues(venues);
      if (!venues.length) setWoltError('Wolt-da filial tapılmadı');
      else setWoltSelected(new Set(venues.filter((v) => v.lat != null).map((v) => v.slug)));
    } catch (e) {
      setWoltError((e as Error).message);
    } finally {
      setWoltLoading(false);
    }
  };

  const importWolt = async () => {
    const toImport = woltVenues.filter((v) => woltSelected.has(v.slug) && v.lat != null && v.lng != null);
    if (!toImport.length) return;
    setWoltImporting(true);
    const count = await upsertBranches(woltStoreId, toImport).catch(() => 0);
    setWoltImporting(false);
    setMsg({ ok: true, text: `${count} filial əlavə edildi` });
    setWoltOpen(false);
    setWoltVenues([]);
    load();
  };

  /**
   * Resolves the one link box into coordinates.
   *
   * The box holds what the app will open *and* what the coordinates are read
   * from, so there is nothing to keep in step between two fields. A plain
   * address works too — then it is only used to locate the branch and is not
   * stored as a link, since it would not open anything.
   */
  const resolveFromLink = async () => {
    const q = (edit?.maps_url ?? '').trim();
    if (!edit || !q) return;
    setResolving(true);
    try {
      const res = await fetch('/api/geo/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q }) });
      const j = (await res.json()) as { lat: number; lng: number; name?: string; address?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const isLink = /^https?:\/\//i.test(q);
      setEdit({
        ...edit,
        lat: j.lat,
        lng: j.lng,
        name: edit.name || j.name || '',
        address: edit.address || j.address || '',
        maps_url: isLink ? q : null,
      });
      setMsg({ ok: true, text: `Koordinat tapıldı: ${j.lat.toFixed(5)}, ${j.lng.toFixed(5)}${isLink ? '' : ' · ünvan link kimi saxlanılmadı'}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setResolving(false);
    }
  };

  /** Fetch opening hours for the current branch from Wolt by slug. */
  const fetchWoltHours = async () => {
    if (!edit) return;
    const slug = woltEditSlug.trim() || (() => {
      const mu = edit.maps_url ?? '';
      const m = mu.match(/\/venue\/([a-z0-9][a-z0-9-]*)/i);
      return m ? m[1] : '';
    })();
    if (!slug) { setMsg({ ok: false, text: 'Wolt slug tapılmadı. Filial adını yaz, sonra Wolt autosuggest-dən seç.' }); return; }
    setWoltHoursFetching(true);
    try {
      const res = await fetch(`/api/import/wolt/venue?slug=${encodeURIComponent(slug)}`);
      const j = (await res.json()) as { open_from?: string | null; open_until?: string | null; error?: string };
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      if (!j.open_from && !j.open_until) { setMsg({ ok: false, text: 'Wolt-da bu filial üçün iş saatı tapılmadı.' }); return; }
      setEdit({ ...edit, ...(j.open_from ? { open_from: j.open_from } : {}), ...(j.open_until ? { open_until: j.open_until } : {}) });
      setMsg({ ok: true, text: `Wolt saatları dolduruldu: ${j.open_from ?? '…'}–${j.open_until ?? '…'}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setWoltHoursFetching(false);
    }
  };

  const load = async () => {
    const [s, b] = await Promise.all([
      db.select<Store>('stores', { order: 'name' }),
      // Without fetchAll PostgREST stops at 1000 rows, so a table with more
      // branches than that shows only the first slice — and deleting what is on
      // screen looks like the rows survived, because the next slice takes their
      // place on reload.
      db.select<Branch>('branches', { order: 'name', fetchAll: true }),
    ]).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return [[], []] as [Store[], Branch[]]; });
    setStores(s);
    setRows(b);
  };
  useEffect(() => { load(); }, []);

  const save = async (b: Branch) => {
    const row = { ...b, id: b.id || branchId(b.store_id, b.name), lat: Number(b.lat), lng: Number(b.lng), open_until: b.open_until || null, open_from: b.open_from?.trim() || null, maps_url: b.maps_url?.trim() || null, phone: b.phone?.trim() || null };
    const error = await db.upsert('branches', [row]).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !error, text: error ?? `${row.name} yadda saxlanıldı` });
    if (!error) { setEdit(null); load(); }
  };
  const remove = async (b: Branch) => {
    if (!confirm(`${b.name} silinsin?`)) return;
    const error = await db.delete('branches', { id: b.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !error, text: error ?? 'Silindi' });
    load();
  };
  const storeOf = (id: string) => stores.find((s) => s.id === id);
  /** Rows the table is showing, which is also what "select all" and bulk delete act on. */
  const shown = storeFilter ? rows.filter((r) => r.store_id === storeFilter) : rows;

  /**
   * Deletes every selected branch.
   *
   * The gateway deletes one row per call, so these go out in small parallel
   * batches: eighty sequential round trips after a bad import is a long wait,
   * and firing all eighty at once is impolite to the API.
   */
  const removeSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    const names = rows.filter((r) => ids.includes(r.id)).slice(0, 3).map((r) => r.name).join(', ');
    if (!confirm(`${ids.length} filial silinəcək (${names}${ids.length > 3 ? ' və başqaları' : ''}).\n\nBu, geri qaytarıla bilməz. Davam edilsin?`)) return;
    setBulkDeleting(true);
    let failed = 0;
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const res = await Promise.allSettled(batch.map((id) => db.delete('branches', { id })));
      failed += res.filter((r) => r.status === 'rejected').length;
    }
    setBulkDeleting(false);
    setSelected(new Set());
    // Count what is actually left rather than trusting the calls: a delete that
    // matches no row succeeds quietly, so "silindi" must be checked, not assumed.
    const left = await db.count('branches').catch(() => -1);
    setMsg({
      ok: failed === 0,
      text: failed
        ? `${ids.length - failed} filial silindi, ${failed} silinmədi`
        : `${ids.length} filial silindi${left >= 0 ? ` · bazada ${left} filial qaldı` : ''}`,
    });
    load();
  };

  /**
   * Deletes every branch of one store in a single request.
   *
   * Row-by-row deletion only reaches what the table listed, which is the wrong
   * tool for clearing a chain before re-importing it: the filter is sent to the
   * database instead, so rows the page never showed go too.
   */
  const removeStore = async () => {
    const st = storeOf(storeFilter);
    if (!storeFilter || !st) return;
    const before = await db.count('branches', { store_id: storeFilter }).catch(() => -1);
    if (before === 0) { setMsg({ ok: true, text: `${st.name} üçün bazada filial yoxdur` }); return; }
    const n = before < 0 ? shown.length : before;
    if (!confirm(`${st.name} marketinin bazadakı BÜTÜN filialları (${n}) silinəcək.\n\nBu, geri qaytarıla bilməz. Davam edilsin?`)) return;
    setBulkDeleting(true);
    const error = await db.delete('branches', { store_id: storeFilter }).then(() => null, (e: Error) => e.message);
    const left = error ? -1 : await db.count('branches', { store_id: storeFilter }).catch(() => -1);
    setBulkDeleting(false);
    setSelected(new Set());
    setMsg(
      error ? { ok: false, text: error }
        : left > 0 ? { ok: false, text: `${left} filial silinmədi — baza icazəsini yoxla` }
        : { ok: true, text: `${st.name}: ${n} filial silindi` },
    );
    load();
  };

  /** Apply bulk hours to all branches of a given store (or all stores if storeId is ''). */
  /**
   * A store's hours in branch shape. Hours are kept on the store, so a new branch
   * starts from its chain's rather than from a hardcoded 08:00–23:00 that was
   * right for nobody in particular.
   */
  const storeHours = (id: string): { open_from: string; open_until: string } => {
    const st = stores.find((x) => x.id === id);
    if (st?.always_open) return { open_from: '00:00', open_until: '23:59' };
    return { open_from: st?.open_from ?? '', open_until: st?.open_until ?? '' };
  };

  /** Store changed in the form: follow the new chain's hours unless they were edited by hand. */
  const changeStore = (nextId: string) => {
    if (!edit) return;
    const before = storeHours(edit.store_id);
    const untouched = (edit.open_from ?? '') === before.open_from && (edit.open_until ?? '') === before.open_until;
    setEdit({ ...edit, store_id: nextId, ...(untouched ? storeHours(nextId) : {}) });
  };

  /**
   * Clears a branch's own hours so it falls back to its store's.
   *
   * This replaces the old bulk-apply, which wrote explicit hours onto every
   * branch — exactly what now blocks inheritance: a branch carrying its own
   * hours ignores the store, so changing the chain's hours later would leave
   * those branches behind.
   */
  const resetToStoreHours = async () => {
    const scope = bulkHoursStoreId ? rows.filter((r) => r.store_id === bulkHoursStoreId) : rows;
    const targets = scope.filter((r) => r.open_from || r.open_until);
    if (!targets.length) { setMsg({ ok: true, text: 'Bu marketin filiallarının hamısı onsuz da marketin saatını işlədir.' }); return; }
    if (!confirm(`${targets.length} filialın öz iş saatı silinəcək və onlar marketin saatını işlədəcək. Davam edilsin?`)) return;
    setBulkHoursApplying(true);
    try {
      await db.upsert('branches', targets.map((r) => ({ ...r, open_from: null, open_until: null })), 'id');
      setMsg({ ok: true, text: `${targets.length} filial marketin saatına keçirildi` });
      setBulkHoursOpen(false);
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBulkHoursApplying(false);
    }
  };

  /** Trigger Wolt autosuggest after 400 ms debounce. */
  const onNameChange = (value: string) => {
    if (!edit) return;
    setEdit({ ...edit, name: value });
    if (woltSuggestTimer.current) clearTimeout(woltSuggestTimer.current);
    if (value.trim().length >= 2) {
      woltSuggestTimer.current = setTimeout(async () => {
        setWoltSuggestLoading(true);
        try {
          const venues = await fetchVenues(value.trim());
          setWoltSuggestVenues(venues.slice(0, 6));
        } catch { setWoltSuggestVenues([]); }
        finally { setWoltSuggestLoading(false); }
      }, 400);
    } else {
      setWoltSuggestVenues([]);
    }
  };

  return (
    <Shell title="Filiallar">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      <div className="toolbar">
        <span className="muted">Google Maps-də filialı tap → "Paylaş" → linki kopyala → "Yeni filial"də yapışdır.</span>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
            <button
              className={`btn ghost${view === 'table' ? ' active' : ''}`}
              style={{ borderRadius: 0, gap: 4, borderRight: '1px solid #E2E8F0', background: view === 'table' ? '#F1F5F9' : undefined }}
              onClick={() => setView('table')}
            >
              <Table size={14} /> Cədvəl
            </button>
            <button
              className={`btn ghost${view === 'map' ? ' active' : ''}`}
              style={{ borderRadius: 0, gap: 4, background: view === 'map' ? '#F1F5F9' : undefined }}
              onClick={() => setView('map')}
            >
              <Map size={14} /> Xəritə
            </button>
          </div>
          <button className="btn secondary" style={{ gap: 4 }} onClick={() => setBulkHoursOpen((o) => !o)}>
            <Clock size={14} /> Saatları markete bağla
          </button>
          <button className="btn secondary" disabled={!stores.length} onClick={() => setImportOpen(true)}>
            <FileSpreadsheet size={14} /> Excel ilə idxal
          </button>
          <button className="btn secondary" disabled={!stores.length} onClick={() => { setWoltOpen((o) => !o); setBulk([]); setWoltVenues([]); setWoltSelected(new Set()); setWoltError(''); setWoltStoreId(stores[0]?.id ?? ''); setWoltQuery(stores[0]?.name ?? ''); }}>
            <Search size={14} /> Wolt-dan çək
          </button>
          <button className="btn" disabled={!stores.length} onClick={() => { setWoltSuggestVenues([]); setWoltEditSlug(''); setEdit({ id: '', store_id: stores[0]?.id ?? '', name: '', address: '', lat: 40.4093, lng: 49.8671, ...storeHours(stores[0]?.id ?? ''), maps_url: '', phone: '' }); }}>
            <Plus size={14} /> Yeni filial
          </button>
        </div>
      </div>

      {importOpen && (
        <BranchImport
          stores={stores}
          existing={rows}
          onClose={() => setImportOpen(false)}
          onDone={(text, ok) => { setMsg({ ok, text }); if (ok) load(); }}
        />
      )}

      {/* ── Reset-to-store-hours panel ───────────────────────────────────────── */}
      {bulkHoursOpen && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={15} /> Saatları markete bağla</b>
            <button className="btn ghost" onClick={() => setBulkHoursOpen(false)}><X size={14} /></button>
          </div>
          <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 12px' }}>
            İş saatı artıq Marketlər səhifəsində bir dəfə yazılır və filiallar onu miras alır.
            Öz saatı yazılmış filial isə marketin saatını görmür — sonradan marketin saatını dəyişsən, o filiallar köhnə saatda qalar.
            Bu düymə həmin filialların öz saatını silir ki, hamısı markete bağlansın.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#6B7280' }}>
              Market
              <select value={bulkHoursStoreId} onChange={(e) => setBulkHoursStoreId(e.target.value)} style={{ minWidth: 130 }}>
                <option value="">Hamısı</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <button className="btn" disabled={bulkHoursApplying} onClick={resetToStoreHours}>
              {bulkHoursApplying ? 'Tətbiq edilir…' : 'Öz saatını sil, marketdən götürsün'}
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#92400E', marginTop: 10 }}>
            {(() => {
              const scope = bulkHoursStoreId ? rows.filter((r) => r.store_id === bulkHoursStoreId) : rows;
              const own = scope.filter((r) => r.open_from || r.open_until).length;
              const name = bulkHoursStoreId ? `"${stores.find((s) => s.id === bulkHoursStoreId)?.name ?? ''}" marketinin` : 'Bütün marketlərin';
              return own
                ? `${name} ${own} filialının öz saatı var — onlar markete bağlanacaq (qalan ${scope.length - own} filial onsuz da markete bağlıdır).`
                : `${name} bütün filialları onsuz da marketin saatını işlədir.`;
            })()}
          </div>
        </div>
      )}

      {/* ── Wolt import panel ────────────────────────────────────────────────── */}
      {woltOpen && (
        <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button className="btn" disabled={bulkRunning} onClick={importAll} style={{ gap: 6 }}>
              <RefreshCw size={14} style={bulkRunning ? { animation: 'spin 1s linear infinite' } : {}} />
              {bulkRunning ? 'Çəkilir…' : 'Hamısını avtomatik çək'}
            </button>
            <span className="muted" style={{ fontSize: 12 }}>Hər marketin filiallarını Wolt-dan avtomatik tapır və əlavə edir</span>
            <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => { setWoltOpen(false); setBulk([]); }}><X size={14} /></button>
          </div>

          {bulk.length > 0 && (
            <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
              {bulk.map((b) => (
                <div key={b.storeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#fff', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: b.status === 'done' ? '#22C55E' : b.status === 'error' ? '#EF4444' : b.status === 'loading' ? '#3B82F6' : '#D1D5DB', display: 'inline-block' }} />
                  <span style={{ flex: 1, fontWeight: 500 }}>{b.name}</span>
                  {b.status === 'loading' && <span className="muted">axtarılır…</span>}
                  {b.status === 'done' && <span style={{ color: '#16A34A' }}>{b.count} filial</span>}
                  {b.status === 'error' && <span style={{ color: '#DC2626', fontSize: 11 }}>xəta: {b.error?.slice(0, 120)}</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid #BAE6FD', paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Əl ilə axtarış (bir market üçün):</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <select value={woltStoreId} onChange={(e) => {
                const sid = e.target.value;
                const name = stores.find((s) => s.id === sid)?.name ?? '';
                setWoltStoreId(sid); setWoltQuery(name);
                setWoltVenues([]); setWoltSelected(new Set()); setWoltError('');
                searchWolt(name, sid);
              }} style={{ minWidth: 120 }}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={woltQuery} onChange={(e) => setWoltQuery(e.target.value)} placeholder="Axtarış mətni" onKeyDown={(e) => e.key === 'Enter' && searchWolt()} style={{ flex: 1, minWidth: 140 }} />
              <button className="btn secondary" disabled={woltLoading || !woltQuery.trim() || !woltStoreId} onClick={() => searchWolt()}>
                {woltLoading ? 'Axtarılır…' : <><Search size={14} /> Axtar</>}
              </button>
            </div>

            {woltError && <div className="alert err" style={{ marginTop: 10 }}>{woltError}</div>}

            {woltVenues.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{woltVenues.length} filial tapıldı</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setWoltSelected(new Set(woltVenues.filter((v) => v.lat != null).map((v) => v.slug)))}>Hamısı</button>
                    <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setWoltSelected(new Set())}>Heç biri</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                  {woltVenues.map((v) => (
                    <label key={v.slug} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: woltSelected.has(v.slug) ? '#E0F2FE' : '#fff', borderRadius: 8, cursor: v.lat != null ? 'pointer' : 'not-allowed', border: '1px solid #E2E8F0', opacity: v.lat == null ? 0.5 : 1 }}>
                      <input type="checkbox" checked={woltSelected.has(v.slug)} disabled={v.lat == null} style={{ marginTop: 2, width: 'auto', flexShrink: 0 }}
                        onChange={(e) => setWoltSelected((prev) => { const s = new Set(prev); e.target.checked ? s.add(v.slug) : s.delete(v.slug); return s; })} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                        {v.address && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{v.address}</div>}
                        {v.lat != null
                          ? <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>{v.lat.toFixed(5)}, {v.lng!.toFixed(5)}</div>
                          : <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>Koordinat yoxdur</div>}
                      </div>
                      <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#0EA5E9', flexShrink: 0, alignSelf: 'center' }} onClick={(e) => e.stopPropagation()}>Wolt →</a>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn" disabled={woltImporting || woltSelected.size === 0} onClick={importWolt}>
                    {woltImporting ? 'Əlavə edilir…' : `${woltSelected.size} filial əlavə et`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Table view ───────────────────────────────────────────────────────── */}
      {view === 'table' && (
        <>
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <select value={storeFilter} onChange={(e) => { setStoreFilter(e.target.value); setSelected(new Set()); }} title="Marketə görə süzgəc">
            <option value="">Bütün marketlər ({rows.length})</option>
            {stores.map((s2) => <option key={s2.id} value={s2.id}>{s2.name} ({rows.filter((r) => r.store_id === s2.id).length})</option>)}
          </select>
          {storeFilter && (
            <button className="btn danger" disabled={bulkDeleting} onClick={removeStore} title="Bazadakı bütün filialları silir — səhifədə görünənləri yox">
              <Trash2 size={14} /> {bulkDeleting ? 'Silinir…' : `${storeOf(storeFilter)?.name ?? 'Market'}: hamısını sil`}
            </button>
          )}
          {selected.size > 0 && (
            <>
              <span className="muted">{selected.size} filial seçildi</span>
              <button className="btn danger" disabled={bulkDeleting} onClick={removeSelected}>
                <Trash2 size={14} /> {bulkDeleting ? 'Silinir…' : `${selected.size} filialı sil`}
              </button>
              <button className="btn ghost" onClick={() => setSelected(new Set())}>Seçimi ləğv et</button>
            </>
          )}
        </div>
        <table>
          <thead><tr>
            <th style={{ width: 32 }}>
              <input
                type="checkbox"
                title="Hamısını seç"
                checked={shown.length > 0 && shown.every((b) => selected.has(b.id))}
                onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((b) => b.id)) : new Set())}
              />
            </th>
            <th>Market</th><th>Filial</th><th>Ünvan</th><th>Koordinat</th><th>Açıq</th><th></th>
          </tr></thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id} style={selected.has(b.id) ? { background: '#EFF6FF' } : undefined}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })}
                  />
                </td>
                <td><span className="avatar" style={{ background: storeOf(b.store_id)?.color ?? '#999' }}>{storeOf(b.store_id)?.initial}</span>{storeOf(b.store_id)?.name ?? b.store_id}</td>
                <td><b>{b.name}</b></td>
                <td className="muted">{b.address}</td>
                <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}><a href={b.maps_url || `https://www.google.com/maps?q=${b.lat},${b.lng}`} target="_blank" rel="noreferrer"><MapPin size={12} style={{ verticalAlign: -2 }} /> {Number(b.lat).toFixed(5)}, {Number(b.lng).toFixed(5)}</a></td>
                <td className="muted">
                  {(() => {
                    // A branch with no hours of its own runs on its store's, so show
                    // those rather than a dash that reads as "no hours at all".
                    const own = b.open_from || b.open_until;
                    const h = own ? { open_from: b.open_from ?? '', open_until: b.open_until ?? '' } : storeHours(b.store_id);
                    if (h.open_from === '00:00' && h.open_until === '23:59') return own ? '24 saat' : <span title="Marketdən gəlir">24 saat ·<i> marketdən</i></span>;
                    if (!h.open_from && !h.open_until) return '—';
                    const text = `${h.open_from || '…'}–${h.open_until || '…'}`;
                    return own ? text : <span title="Marketdən gəlir">{text} ·<i> marketdən</i></span>;
                  })()}
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="btn ghost" onClick={() => { setWoltSuggestVenues([]); setWoltEditSlug(''); setEdit(b); }}>Düzəlt</button>
                  <button className="btn ghost" onClick={() => remove(b)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 30 }}>{rows.length ? 'Bu marketin filialı yoxdur.' : 'Filial yoxdur. Tətbiqdə xəritə və "ən yaxın filial" buradan gəlir.'}</td></tr>}
          </tbody>
        </table>
        </>
      )}

      {/* ── Map view ─────────────────────────────────────────────────────────── */}
      {view === 'map' && (
        <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', position: 'relative' }}>
          {!leafletReady && (
            <div style={{ height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: 14 }}>
              Xəritə yüklənir…
            </div>
          )}
          <div
            ref={mapContainerRef}
            style={{ height: 520, display: leafletReady ? 'block' : 'none' }}
          />
          <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#475569', pointerEvents: 'none', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            Xəritəyə klikləyin → yeni filial koordinatı
          </div>
        </div>
      )}

      {/* ── Edit / New branch modal ───────────────────────────────────────────── */}
      {edit && (
        <div className="modal-bg" onClick={() => { setEdit(null); setWoltSuggestVenues([]); setWoltEditSlug(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.id ? 'Filialı düzəlt' : 'Yeni filial'}</h2>
              <button className="btn ghost" onClick={() => { setEdit(null); setWoltSuggestVenues([]); setWoltEditSlug(''); }}><X size={18} /></button>
            </div>

            {/* One link box: it is what the app opens, and where the coordinates come from. */}
            <div style={{ marginTop: 14, padding: 12, background: '#FAFAFA', borderRadius: 12 }}>
              <label style={{ fontSize: 12, color: '#6B7280' }}>Google Maps linki — tətbiqdə “Google Maps-də aç” bunu açır</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  value={edit.maps_url ?? ''}
                  onChange={(e) => setEdit({ ...edit, maps_url: e.target.value })}
                  placeholder="https://maps.app.goo.gl/… və ya ünvan: Nərimanov, Ə. Ələkbərov 12"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === 'Enter' && resolveFromLink()}
                  onBlur={() => { if (!edit.lat || !edit.lng) resolveFromLink(); }}
                />
                <button className="btn secondary" disabled={resolving || !(edit.maps_url ?? '').trim()} onClick={resolveFromLink}>
                  <MapPin size={14} /> {resolving ? 'Axtarılır…' : 'Koordinatı tap'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                Linki yapışdır — koordinat özü tapılır. Link əvəzinə ünvan da yaza bilərsən; onda tətbiqdə xəritə koordinata görə açılır.
              </div>

              <iframe title="map" src={`https://www.google.com/maps?q=${edit.lat},${edit.lng}&z=16&output=embed`} style={{ width: '100%', height: 180, border: 0, borderRadius: 10, marginTop: 10 }} loading="lazy" />
            </div>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <label>Market<select value={edit.store_id} onChange={(e) => changeStore(e.target.value)}>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>

              {/* Branch name with Wolt autosuggest */}
              <label style={{ position: 'relative' }}>
                Filial adı {woltSuggestLoading && <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 400 }}>(Wolt-da axtarılır…)</span>}
                <input
                  value={edit.name}
                  onChange={(e) => onNameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setWoltSuggestVenues([]), 200)}
                  placeholder="Araz Market Nərimanov"
                  autoComplete="off"
                />
                {woltSuggestVenues.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: 220, overflowY: 'auto' }}>
                    <div style={{ padding: '6px 10px', fontSize: 11, color: '#6B7280', borderBottom: '1px solid #F1F5F9' }}>Wolt-dan tap — birini seçin</div>
                    {woltSuggestVenues.map((v) => (
                      <div
                        key={v.slug}
                        onMouseDown={() => {
                          setEdit({ ...edit, name: v.name, address: v.address ?? edit.address, lat: v.lat ?? edit.lat, lng: v.lng ?? edit.lng, maps_url: v.url ?? edit.maps_url });
                          setWoltEditSlug(v.slug);
                          setWoltSuggestVenues([]);
                        }}
                        style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #F8FAFC' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F9FF')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <div style={{ fontWeight: 600 }}>{v.name}</div>
                        {v.address && <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{v.address}</div>}
                        {v.lat != null && <div style={{ color: '#94A3B8', fontSize: 11, fontFamily: 'monospace' }}>{v.lat.toFixed(4)}, {v.lng!.toFixed(4)}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </label>

              <label className="full">Ünvan<input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} placeholder="Ə. Ələkbərov küç. 12, Nərimanov" /></label>
              <label>Lat<input type="number" step="any" value={edit.lat} onChange={(e) => setEdit({ ...edit, lat: Number(e.target.value) })} /></label>
              <label>Lng<input type="number" step="any" value={edit.lng} onChange={(e) => setEdit({ ...edit, lng: Number(e.target.value) })} /></label>
              <label>Açılış (saat)<input value={edit.open_from ?? ''} onChange={(e) => setEdit({ ...edit, open_from: e.target.value })} placeholder="08:00" disabled={edit.open_from === '00:00' && edit.open_until === '23:59'} /></label>
              <label>Bağlanış (saat)<input value={edit.open_until ?? ''} onChange={(e) => setEdit({ ...edit, open_until: e.target.value })} placeholder="23:00" disabled={edit.open_from === '00:00' && edit.open_until === '23:59'} /></label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={edit.open_from === '00:00' && edit.open_until === '23:59'} onChange={(e) => setEdit({ ...edit, open_from: e.target.checked ? '00:00' : '08:00', open_until: e.target.checked ? '23:59' : '23:00' })} style={{ width: 'auto' }} /> 24 saat açıqdır</label>
              <div className="muted" style={{ gridColumn: '1 / -1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {(() => {
                  const h = storeHours(edit.store_id);
                  const name = stores.find((x) => x.id === edit.store_id)?.name ?? '';
                  if (!h.open_from && !h.open_until) return <span>“{name}” üçün iş saatı yazılmayıb — Marketlər səhifəsində bir dəfə yazsan, bütün filiallar onu alacaq.</span>;
                  const label = h.open_from === '00:00' && h.open_until === '23:59' ? '24 saat' : `${h.open_from || '…'}–${h.open_until || '…'}`;
                  const same = (edit.open_from ?? '') === h.open_from && (edit.open_until ?? '') === h.open_until;
                  return (
                    <>
                      <span>“{name}” marketinin saatı: <b>{label}</b>{same ? ' — bu filial onu işlədir' : ' · bu filial fərqli saatla saxlanılacaq'}</span>
                      {!same && <button className="btn ghost" style={{ fontSize: 12, padding: '2px 8px' }} onClick={() => setEdit({ ...edit, ...h })}>Market saatına qaytar</button>}
                    </>
                  );
                })()}
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn secondary" style={{ fontSize: 12, padding: '4px 10px', gap: 4, whiteSpace: 'nowrap' }} disabled={woltHoursFetching} onClick={fetchWoltHours}>
                  <Clock size={13} /> {woltHoursFetching ? 'Wolt-dan çəkilir…' : 'Wolt-dan saatları çək'}
                </button>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Wolt autosuggest-dən seçilmiş filialın saatlarını doldurur</span>
              </div>
              <label>Telefon<input value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+994 12 000 00 00" /></label>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => { setEdit(null); setWoltSuggestVenues([]); setWoltEditSlug(''); }}>Ləğv et</button>
              <button className="btn" disabled={!edit.name || !edit.address} onClick={() => save(edit)}>Saxla</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Escape HTML for safe insertion into Leaflet popup content strings. */
function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
