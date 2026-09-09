'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, X } from 'lucide-react';
import { Branch, Store, db, slugify } from '@/lib/supabase';

/**
 * The template's columns. Hours are deliberately absent: they belong to the
 * store now, so every branch of a chain inherits them and repeating them per row
 * would only create rows that disagree with each other.
 *
 * Extra columns are still read when a sheet happens to carry them — Enlik,
 * Uzunluq and Telefon are recognised on upload even though the template omits
 * them.
 */
const COLUMNS = ['Market', 'Filial adı', 'Ünvan', 'Google Maps ünvan linki'] as const;

const SAMPLE = [
  ['Araz', 'Neftçilər Superstore', 'Bakı, Nizami rayonu, Şərifli küçəsi 25', 'https://www.google.com/maps/search/?api=1&query=Araz+Market+Neftçilər'],
  ['Bravo', 'Gənclik Mall', 'Bakı, Fətəli Xan Xoyski 16', ''],
];

interface Row {
  store_id: string;
  storeLabel: string;
  name: string;
  address: string;
  maps_url: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  open_from: string;
  open_until: string;
  always_open: boolean;
  note: string;
  ok: boolean;
}

const yes = (v: string) => /^(b(ə|e)li|h(ə|e)|yes|true|1|24)$/i.test(v.trim());

/**
 * Azerbaijan's bounding box, used to catch coordinates that are simply wrong.
 *
 * Latitude and longitude are easy to fill in the wrong order, and nothing about
 * the numbers says so: 49.8 is a perfectly valid latitude, it just puts a Baku
 * branch in the Baltic. Swapped pairs are corrected, pairs that land outside the
 * country are refused rather than imported into the wrong place silently.
 */
const AZ_BOUNDS = { lat: [38.2, 42.0], lng: [44.6, 50.7] } as const;
const inside = (lat: number, lng: number) =>
  lat >= AZ_BOUNDS.lat[0] && lat <= AZ_BOUNDS.lat[1] && lng >= AZ_BOUNDS.lng[0] && lng <= AZ_BOUNDS.lng[1];

/** null when the pair cannot be trusted; `swapped` when the columns were the wrong way round. */
function checkCoords(lat: number, lng: number): { lat: number; lng: number; swapped: boolean } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (inside(lat, lng)) return { lat, lng, swapped: false };
  if (inside(lng, lat)) return { lat: lng, lng: lat, swapped: true };
  return null;
}
const clean = (v: unknown) => String(v ?? '').trim();

/** Bulk branch import: download the template, fill it in Excel, upload it back. */
export function BranchImport({ stores, onDone, onClose }: { stores: Store[]; onDone: (msg: string, ok: boolean) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState('');
  const [fileName, setFileName] = useState('');

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([[...COLUMNS], ...SAMPLE]);
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filiallar');
    XLSX.writeFile(wb, 'filial-numune.xlsx');
  };

  /**
   * Matches the sheet's store column against the store list.
   *
   * Sheets write the chain's full name ("Araz Market") where the store is saved
   * as "Araz", so after the exact checks the generic words are dropped from both
   * sides and compared again. An ambiguous result is left unmatched rather than
   * guessed — putting prices on the wrong chain is worse than one manual fix.
   */
  const bare = (v: string) => v.toLowerCase().replace(/\b(super)?(market|store|mağaza)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '').trim();
  const matchStore = (raw: string): Store | undefined => {
    const v = raw.trim().toLowerCase();
    if (!v) return undefined;
    const exact = stores.find((s) => s.id.toLowerCase() === v) ?? stores.find((s) => s.name.toLowerCase() === v) ?? stores.find((s) => slugify(s.name) === slugify(v));
    if (exact) return exact;
    const key = bare(v);
    if (!key) return undefined;
    const loose = stores.filter((s) => bare(s.name) === key || bare(s.id) === key);
    return loose.length === 1 ? loose[0] : undefined;
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    setBusy('Oxunur…');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
      // Find the header row rather than assuming row 1, so a title line above it is tolerated.
      const headerAt = grid.findIndex((r) => r.some((c) => clean(c).toLowerCase().startsWith('market')));
      const header = (grid[headerAt] ?? []).map((c) => clean(c).toLowerCase());
      const col = (name: string) => header.findIndex((h) => h.startsWith(name.toLowerCase().slice(0, 6)));
      const idx = {
        store: col('Market'), name: col('Filial'), address: col('Ünvan'), link: col('Google'),
        lat: col('Enlik'), lng: col('Uzunluq'), phone: col('Telefon'),
        from: col('Açılış'), until: col('Bağlanış'), always: col('24 saat'),
      };
      const at = (r: unknown[], i: number) => (i >= 0 ? clean(r[i]) : '');

      const parsed: Row[] = [];
      for (const r of grid.slice(headerAt + 1)) {
        const storeRaw = at(r, idx.store);
        const name = at(r, idx.name);
        if (!storeRaw && !name) continue;
        const store = matchStore(storeRaw);
        const rawLat = Number(at(r, idx.lat).replace(',', '.'));
        const rawLng = Number(at(r, idx.lng).replace(',', '.'));
        const coords = checkCoords(rawLat, rawLng);
        const badCoords = !coords && at(r, idx.lat) !== '' && at(r, idx.lng) !== '';
        const lat = coords?.lat ?? NaN;
        const lng = coords?.lng ?? NaN;
        const link = at(r, idx.link);
        const address = at(r, idx.address);
        const hasCoords = !!coords;
        parsed.push({
          store_id: store?.id ?? '',
          storeLabel: storeRaw,
          name,
          address,
          maps_url: link,
          lat: hasCoords ? lat : null,
          lng: hasCoords ? lng : null,
          phone: at(r, idx.phone),
          open_from: at(r, idx.from),
          open_until: at(r, idx.until),
          always_open: yes(at(r, idx.always)),
          note: !store
            ? `"${storeRaw}" adlı market yoxdur`
            : !name
              ? 'Filial adı boşdur'
              : badCoords
                ? 'Koordinat Azərbaycandan kənardadır — nəzərə alınmadı, link/ünvan işlədiləcək'
                : coords?.swapped
                  ? 'Enlik/uzunluq yerləri dəyişik idi — düzəldildi'
                  : hasCoords
                    ? ''
                    : link || address
                      ? 'Koordinat linkdən tapılacaq'
                      : 'Nə koordinat, nə link, nə ünvan var',
          ok: !!store && !!name && (hasCoords || !!link || !!address),
        });
      }
      setRows(parsed);
      setBusy('');
    } catch (e) {
      setBusy('');
      onDone((e as Error).message, false);
    }
  };

  const run = async () => {
    const usable = rows.filter((r) => r.ok);
    if (!usable.length) return;
    setBusy('İdxal edilir…');
    const out: Record<string, unknown>[] = [];
    const unresolved: Row[] = [];
    for (let i = 0; i < usable.length; i++) {
      const r = usable[i];
      let { lat, lng } = r;
      if (lat == null || lng == null) {
        setBusy(`Koordinat axtarılır ${i + 1}/${usable.length}…`);
        // Geocoding goes through OpenStreetMap, whose fair-use policy is one call
        // a second. Eighty rows sent back to back would be throttled or blocked,
        // so pace them — the progress line above says which row is in flight.
        if (i > 0) await new Promise((ok) => setTimeout(ok, 1100));
        // Which source to believe first.
        //
        // A real Maps link — a share link, a /maps/place/ URL, or one carrying
        // coordinates outright — resolves exactly, so it wins. A short link holds
        // no coordinates in its text but yields them once followed, which is why
        // this tests the *kind* of link rather than looking for digits in it.
        //
        // Only the "?query=<place name>" form is worse than the address, since it
        // carries the brand and the branch name and geocodes poorly.
        const link = r.maps_url;
        const realLink = /maps\.app\.goo\.gl|goo\.gl\/maps|\/maps\/place\/|@-?\d|!3d-?\d|[?&](?:q|ll|destination|center)=-?\d/.test(link);
        const sources = realLink ? [link, r.address] : [r.address, link];
        for (const q of sources.filter(Boolean)) {
          try {
            const res = await fetch('/api/geo/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ q }),
            });
            const j = (await res.json()) as { lat?: number; lng?: number; error?: string };
            if (!res.ok || j.lat == null || j.lng == null) continue;
            lat = j.lat;
            lng = j.lng;
            break;
          } catch {
            /* try the next source */
          }
        }
        if (lat == null || lng == null) { unresolved.push(r); continue; }
      }
      out.push({
        id: slugify(`${r.store_id} ${r.name} ${r.address.slice(0, 20)}`),
        store_id: r.store_id,
        name: r.name,
        address: r.address,
        lat,
        lng,
        maps_url: r.maps_url || null,
        phone: r.phone || null,
        open_from: r.always_open ? '00:00' : r.open_from || null,
        open_until: r.always_open ? '23:59' : r.open_until || null,
        always_open: r.always_open,
      } satisfies Record<string, unknown> & Partial<Branch>);
    }

    try {
      if (out.length) await db.upsert('branches', out, 'id');
      onDone(`${out.length} filial idxal edildi${unresolved.length ? `, ${unresolved.length} sətir üçün yer tapılmadı` : ''}`, unresolved.length === 0);
      if (unresolved.length) {
        // Keep the dialog open on the leftovers: the next step is collecting a
        // link for each, and closing would lose the list of which ones they are.
        setRows(unresolved.map((r) => ({ ...r, note: 'Yer tapılmadı — Google Maps linkini əlavə et', ok: false })));
        setFileName('');
      } else {
        onClose();
      }
    } catch (e) {
      onDone((e as Error).message, false);
    } finally {
      setBusy('');
    }
  };

  const good = rows.filter((r) => r.ok).length;
  const stuck = rows.filter((r) => !r.ok);

  /** The leftovers as a sheet, so a link can be pasted per row and re-uploaded. */
  const exportStuck = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUMNS],
      ...stuck.map((r) => [r.storeLabel || r.store_id, r.name, r.address, r.maps_url]),
    ]);
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(16, c.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Alınmayanlar');
    XLSX.writeFile(wb, 'filial-alinmayanlar.xlsx');
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Excel ilə filial idxalı</h2>
          <button className="btn ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <ol className="note" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Nümunə faylı endir və Excel-də doldur.</li>
          <li><b>Market</b> sütununa mövcud marketin adını yaz (məsələn “Al Market”) — yeni market yaratmır.</li>
          <li>Koordinatı bilmirsənsə <b>Enlik/Uzunluq</b> boş qalsın: Google Maps linkindən, o da yoxdursa ünvandan tapılır.</li>
          <li>İş saatı yazmağa ehtiyac yoxdur — filiallar marketin saatını miras alır (Marketlər səhifəsində bir dəfə yazılır).</li>
          <li>Faylı buraya yüklə, siyahını yoxla və idxal et.</li>
        </ol>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0' }}>
          <button className="btn secondary" onClick={template}><Download size={14} /> Nümunə faylı endir</button>
          <label className="btn" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Fayl seç
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
                e.target.value = '';
              }}
            />
          </label>
          {fileName && <span className="muted">{fileName}</span>}
          {busy && <span className="muted">{busy}</span>}
        </div>

        {rows.length > 0 && (
          <>
            <div style={{ maxHeight: 340, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
              <table>
                <thead><tr><th>Market</th><th>Filial</th><th>Ünvan</th><th>Koordinat</th><th>Vəziyyət</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={r.ok ? undefined : { background: '#fff5f5' }}>
                      <td>{r.store_id || <span className="muted">{r.storeLabel || '—'}</span>}</td>
                      <td>{r.name || '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.address || '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.lat != null ? `${r.lat.toFixed(5)}, ${r.lng?.toFixed(5)}` : '—'}</td>
                      <td style={{ fontSize: 12 }} className={r.ok ? 'muted' : ''}>{r.note || 'hazır'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">{good} sətir idxala hazırdır{rows.length - good ? `, ${rows.length - good} sətirdə problem var` : ''}. Eyni market + filial adı təkrar yüklənsə, məlumat yenilənir, dublikat yaranmır.</p>
          </>
        )}

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Bağla</button>
          {stuck.length > 0 && (
            <button className="btn secondary" onClick={exportStuck}>
              <Download size={14} /> {stuck.length} alınmayanı endir
            </button>
          )}
          <button className="btn" disabled={!good || !!busy} onClick={run}>{busy || `${good} filialı idxal et`}</button>
        </div>
      </div>
    </div>
  );
}
