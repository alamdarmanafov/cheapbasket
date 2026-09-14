'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';
import { detectDelimiter, guessColumns, parseCSV, parsePrice } from '@/lib/csv';

interface Store { id: string; name: string; color: string | null; logo_url: string | null }
type Cols = ReturnType<typeof guessColumns>;

/**
 * The page a store opens from its own link: no login, just the store's name,
 * a file, and a preview of what will be handed over. Nothing goes live from
 * here — the list waits for a person on our side.
 */
export default function PartnerUpload() {
  const { token } = useParams<{ token: string }>();
  const [store, setStore] = useState<Store | null | undefined>(undefined);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [cols, setCols] = useState<Cols>({});
  const [filename, setFilename] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ rows: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/partner?token=${encodeURIComponent(token)}`).then((r) => r.json()).then((j) => setStore(j.store ?? null)).catch(() => setStore(null));
  }, [token]);

  const onFile = async (file: File) => {
    setErr(null); setDone(null); setFilename(file.name);
    let all: string[][];
    if (/\.xlsx?$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      all = (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]).map((r) => r.map((c) => (c == null ? '' : String(c).trim())));
    } else {
      const text = await file.text();
      all = parseCSV(text, detectDelimiter(text));
    }
    const h = (all[0] ?? []).map((x) => x.trim());
    setHeaders(h);
    setRows(all.slice(1));
    setCols(guessColumns(h));
  };

  const parsed = useMemo(() => {
    const { price: pc, name: nc, barcode: bc, brand: brc, size: sc } = cols;
    if (pc == null || (nc == null && bc == null)) return [];
    return rows
      .map((r) => ({
        barcode: bc != null ? r[bc] ?? '' : '',
        name: nc != null ? r[nc] ?? '' : '',
        brand: brc != null ? r[brc] ?? '' : '',
        size: sc != null ? r[sc] ?? '' : '',
        price: parsePrice(r[pc] ?? ''),
      }))
      .filter((r): r is typeof r & { price: number } => r.price != null && !!(r.name || r.barcode));
  }, [rows, cols]);

  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/partner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, filename, note, rows: parsed }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDone({ rows: j.rows });
      setRows([]); setHeaders([]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (label: string, key: keyof Cols) => (
    <label key={key} style={{ display: 'block' }}>
      {label}
      <select value={cols[key] ?? ''} onChange={(e) => setCols({ ...cols, [key]: e.target.value === '' ? undefined : Number(e.target.value) })}>
        <option value="">— yoxdur —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
      </select>
    </label>
  );

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <img src="/icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
        <div><b>Cheap Market AI</b><div className="muted" style={{ fontSize: 12 }}>Partnyor qiymət siyahısı</div></div>
      </div>
      {store === undefined ? <p className="muted">Yoxlanılır…</p> : store === null ? (
        <div className="card"><h2>Link düzgün deyil</h2><p className="muted">Bu link ləğv olunub və ya səhv köçürülüb. Cheap Market AI ilə əlaqə saxlayın.</p></div>
      ) : (
        <div className="card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="avatar" style={{ background: store.color ?? '#6B7280' }}>{store.name.slice(0, 1)}</span> {store.name} — qiymət siyahısı
          </h2>
          <p className="muted" style={{ fontSize: 13 }}>
            CSV və ya Excel faylını seçin: sütunlar <b>barkod</b> və/və ya <b>ad</b>, <b>qiymət</b> (₼), istəyə görə ölçü və brend. Siyahı bizim komandaya çatır, yoxlanılır və tətbiqdə {store.name} qiymətləri kimi göstərilir.
          </p>
          {done && <div className="alert ok">{done.rows} sətir qəbul edildi. Təşəkkür edirik — yoxlanılandan sonra tətbiqdə görünəcək.</div>}
          {err && <div className="alert err">{err}</div>}
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          {headers.length > 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, margin: '16px 0' }}>
                {pick('Barkod', 'barcode')}{pick('Ad', 'name')}{pick('Brend', 'brand')}{pick('Ölçü', 'size')}{pick('Qiymət ₼', 'price')}
              </div>
              <p className="muted" style={{ fontSize: 12 }}>{rows.length} sətirdən {parsed.length} oxundu.</p>
              <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                <table>
                  <thead><tr><th>Barkod</th><th>Ad</th><th>Ölçü</th><th style={{ textAlign: 'right' }}>Qiymət</th></tr></thead>
                  <tbody>{parsed.slice(0, 15).map((r, i) => <tr key={i}><td className="muted">{r.barcode}</td><td>{[r.brand, r.name].filter(Boolean).join(' ')}</td><td>{r.size}</td><td style={{ textAlign: 'right' }}>{r.price.toFixed(2)}</td></tr>)}</tbody>
                </table>
              </div>
              <label style={{ display: 'block', marginTop: 12 }}>Qeyd (istəyə görə)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="məs. bu həftənin qiymətləri" style={{ width: '100%', textAlign: 'left' }} /></label>
              <button className="btn" disabled={busy || !parsed.length} onClick={send} style={{ marginTop: 12 }}><Upload size={14} /> {busy ? 'Göndərilir…' : `Göndər (${parsed.length} sətir)`}</button>
            </>
          )}
        </div>
      )}
    </main>
  );
}
