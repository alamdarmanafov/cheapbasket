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
const COLUMNS = ['Market', 'Filial adı', 'Google Maps linki', 'Ünvan'] as const;

const SAMPLE = [
  ['Araz', 'Neftçilər Superstore', 'https://maps.app.goo.gl/aBcD1234', ''],
  ['Bravo', 'Gənclik Mall', '', ''],
];

interface Row {
  /** store + name — the identity a re-upload matches on. */
  rowId: string;
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

/** Stable identity for a branch: its chain plus its name. */
export const branchId = (storeId: string, name: string) => slugify(`${storeId} ${name}`);

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
export function BranchImport({ stores, existing = [], onDone, onClose }: { stores: Store[]; existing?: Branch[]; onDone: (msg: string, ok: boolean) => void; onClose: () => void }) {
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
      const known = new Set(existing.map((b) => b.id));
      const seenInSheet = new Map<string, number>();
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
        const id = store ? branchId(store.id, name) : '';
        if (id) seenInSheet.set(id, (seenInSheet.get(id) ?? 0) + 1);
        parsed.push({
          rowId: id,
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
                    : link
                      ? 'Koordinat linkdən tapılacaq'
                      : address
                        ? 'Link yoxdur — koordinat ünvandan təxmin ediləcək'
                        : 'Yalnız ad — linki sonra paneldən əlavə edəcəksən',
          // Market and branch name are all a row needs. Without a link or an
          // address the branch is created with no coordinates, and the Google
          // Maps link is pasted into it afterwards in the panel — which is how a
          // chain of ninety branches is realistically entered.
          ok: !!store && !!name,
        });
      }
      // Say up front what each row will do. "Update" is the whole point of a
      // re-upload — a corrected address should land on the branch that already
      // exists, not mint a second one.
      setRows(
        parsed.map((r) => {
          if (!r.ok || !r.rowId) return r;
          if ((seenInSheet.get(r.rowId) ?? 0) > 1) return { ...r, ok: false, note: 'Bu ad faylda təkrarlanır — filial adlarını fərqləndir' };
          return { ...r, note: known.has(r.rowId) ? 'Mövcud filial — ünvan/koordinat yenilənəcək' : r.note || 'Yeni filial' };
        }),
      );
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
      let address = r.address;
      // Nothing to resolve from, so nothing is guessed: the branch is created
      // without coordinates and waits for its link.
      const nothingToResolve = !r.maps_url.trim() && !r.address.trim();
      if ((lat == null || lng == null) && !nothingToResolve) {
        setBusy(`Koordinat axtarılır ${i + 1}/${usable.length}…`);
        // Geocoding goes through OpenStreetMap, whose fair-use policy is one call
        // a second. Eighty rows sent back to back would be throttled or blocked,
        // so pace them — the progress line above says which row is in flight.
        if (i > 0) await new Promise((ok) => setTimeout(ok, 1100));
        // The link is picked for this branch by hand, so it is always tried
        // first, whatever form it takes. Ordering the "?query=<place name>" form
        // below the address was a mistake: a sheet built out of those links then
        // had every pin placed by geocoding the address instead, which is exactly
        // the guesswork the link was supplied to replace. The address stays as a
        // fallback for rows whose link resolves to nothing.
        const sources = [r.maps_url, r.address];
        for (const q of sources.filter(Boolean)) {
          try {
            const res = await fetch('/api/geo/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ q }),
            });
            const j = (await res.json()) as { lat?: number; lng?: number; address?: string; error?: string };
            if (!res.ok || j.lat == null || j.lng == null) continue;
            lat = j.lat;
            lng = j.lng;
            // A sheet of just store, branch and link leaves the address empty, and
            // the app prints it under the branch name — so take the one the
            // resolver found rather than showing a blank line.
            if (!address) address = j.address ?? '';
            break;
          } catch {
            /* try the next source */
          }
        }
        // A row whose link and address both resolve to nothing is still worth
        // creating — the branch exists, only its pin is missing — but it is
        // listed afterwards so the missing links can be filled in.
        if (lat == null || lng == null) unresolved.push(r);
      }
      out.push({
        // A branch is identified by its chain and its name, never by its address.
        // With the address in the id, correcting a typo minted a *new* branch and
        // left the old one behind — the opposite of what re-uploading a fixed
        // sheet is for.
        id: branchId(r.store_id, r.name),
        store_id: r.store_id,
        name: r.name,
        address,
        lat: lat ?? null,
        lng: lng ?? null,
        maps_url: r.maps_url || null,
        phone: r.phone || null,
        open_from: r.always_open ? '00:00' : r.open_from || null,
        open_until: r.always_open ? '23:59' : r.open_until || null,
        always_open: r.always_open,
      } satisfies Record<string, unknown> & Partial<Branch>);
    }

    try {
      if (out.length) await db.upsert('branches', out, 'id');
      onDone(`${out.length} filial idxal edildi${unresolved.length ? `, ${unresolved.length}-i koordinatsız — linki paneldən əlavə et` : ''}`, true);
      if (unresolved.length) {
        // Keep the dialog open on the leftovers: the next step is collecting a
        // link for each, and closing would lose the list of which ones they are.
        setRows(unresolved.map((r) => ({ ...r, note: 'Koordinatsız yaradıldı — Google Maps linkini əlavə et', ok: false })));
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
          <li><b>Google Maps linki</b> əsas sütundur: tətbiqdə “Google Maps-də aç” məhz onu açır və koordinat da ondan tapılır. Paylaşım linki (<code>maps.app.goo.gl/…</code>) və ya yer səhifəsi linki olsun.</li>
          <li><b>Ünvan</b> istəyə görədir — boş qoysan, linkdən tapılan ünvan yazılır.</li>
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
            {(() => {
              // A sheet whose link column is empty imports on geocoded addresses
              // alone: the pins are guesses and "Google Maps-də aç" opens a
              // coordinate rather than the place. That is a quiet loss of quality,
              // so it is stated before the import runs, not discovered after.
              const noLink = rows.filter((r) => r.ok && !r.maps_url.trim()).length;
              if (!noLink) return null;
              return (
                <p className="note" style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' }}>
                  ⚠ {noLink} sətirdə <b>Google Maps linki boşdur</b>{noLink === good ? ' (hamısında)' : ''}. Onların koordinatı ünvandan
                  təxmin ediləcək — nəticə həmişə dəqiq olmur, tətbiqdə “Google Maps-də aç” isə yerin səhifəsini yox, koordinatı açacaq.
                  Dəqiq olsun deyə link sütununu doldur: Google Maps-də yeri aç → <b>Paylaş → Linki kopyala</b>.
                </p>
              );
            })()}
            <p className="note">
              {good} sətir idxala hazırdır{rows.length - good ? `, ${rows.length - good} sətirdə problem var` : ''}.
              Filial <b>market + adı</b> ilə tanınır: eyni adla təkrar yüklənsə ünvanı, koordinatı və linki yenilənir, yeni filial yaranmır.
              Ona görə filial adını dəyişmək yeni filial deməkdir.
            </p>
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
