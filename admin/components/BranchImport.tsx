'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, X } from 'lucide-react';
import { Branch, Store, db, slugify } from '@/lib/supabase';

/** The sheet's columns, in order. Recognised case-insensitively on upload. */
const COLUMNS = ['Market', 'Filial adı', 'Ünvan', 'Google Maps linki', 'Enlik', 'Uzunluq', 'Telefon', 'Açılış', 'Bağlanış', '24 saat'] as const;

const SAMPLE = [
  ['Al Market', 'Nərimanov', 'Ə. Ələkbərov küç. 12, Bakı', 'https://maps.app.goo.gl/xxxxxxxx', '', '', '+994 12 000 00 00', '08:00', '23:00', 'xeyr'],
  ['Bravo', 'Gənclik Mall', 'Fətəli Xan Xoyski 16, Bakı', '', '40.40930', '49.86710', '', '', '', 'bəli'],
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

  /** Matches the sheet's store column against the store list by id or by name. */
  const matchStore = (raw: string): Store | undefined => {
    const v = raw.trim().toLowerCase();
    if (!v) return undefined;
    return stores.find((s) => s.id.toLowerCase() === v) ?? stores.find((s) => s.name.toLowerCase() === v) ?? stores.find((s) => slugify(s.name) === slugify(v));
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
        const lat = Number(at(r, idx.lat).replace(',', '.'));
        const lng = Number(at(r, idx.lng).replace(',', '.'));
        const link = at(r, idx.link);
        const address = at(r, idx.address);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
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
          note: !store ? `"${storeRaw}" adlı market yoxdur` : !name ? 'Filial adı boşdur' : hasCoords ? '' : link || address ? 'Koordinat linkdən tapılacaq' : 'Nə koordinat, nə link, nə ünvan var',
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
    let failed = 0;
    for (let i = 0; i < usable.length; i++) {
      const r = usable[i];
      let { lat, lng } = r;
      if (lat == null || lng == null) {
        setBusy(`Koordinat axtarılır ${i + 1}/${usable.length}…`);
        try {
          const res = await fetch('/api/geo/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: r.maps_url || r.address }),
          });
          const j = (await res.json()) as { lat?: number; lng?: number; error?: string };
          if (!res.ok || j.lat == null || j.lng == null) throw new Error(j.error ?? 'tapılmadı');
          lat = j.lat;
          lng = j.lng;
        } catch {
          failed++;
          continue;
        }
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
      onDone(`${out.length} filial idxal edildi${failed ? `, ${failed} sətir koordinatsız qaldı` : ''}`, true);
      onClose();
    } catch (e) {
      onDone((e as Error).message, false);
    } finally {
      setBusy('');
    }
  };

  const good = rows.filter((r) => r.ok).length;

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
                <thead><tr><th>Market</th><th>Filial</th><th>Ünvan</th><th>Koordinat</th><th>Saat</th><th>Vəziyyət</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={r.ok ? undefined : { background: '#fff5f5' }}>
                      <td>{r.store_id || <span className="muted">{r.storeLabel || '—'}</span>}</td>
                      <td>{r.name || '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.address || '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.lat != null ? `${r.lat.toFixed(5)}, ${r.lng?.toFixed(5)}` : '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.always_open ? '24 saat' : [r.open_from, r.open_until].filter(Boolean).join('–') || '—'}</td>
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
          <button className="btn" disabled={!good || !!busy} onClick={run}>{busy || `${good} filialı idxal et`}</button>
        </div>
      </div>
    </div>
  );
}
