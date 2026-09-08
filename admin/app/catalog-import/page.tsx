'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle, FileText, Loader, Upload, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Store, db } from '@/lib/supabase';

interface ExtractedProduct { name: string; price: number; old_price: number | null; unit?: string; page: number }
interface MatchedProduct extends ExtractedProduct { product_id: string; product_name: string }

export default function CatalogImportPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState('');
  const [marketName, setMarketName] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [matched, setMatched] = useState<MatchedProduct[]>([]);
  const [unmatched, setUnmatched] = useState<ExtractedProduct[]>([]);
  const [applying, setApplying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.select<Store>('stores', { order: 'name' }).then(setStores).catch(() => {});
  }, []);

  const renderPdf = async (file: File) => {
    setBusy(true);
    setMsg(null);
    setPages([]);
    setMatched([]);
    setUnmatched([]);
    setRenderProgress(0);

    // Load PDF.js dynamically
    const pdfjsLib = (window as unknown as { pdfjsLib?: PdfjsLib }).pdfjsLib;
    if (!pdfjsLib) {
      setMsg({ ok: false, text: 'PDF.js yüklənmədi. Səhifəni yeniləyin.' });
      setBusy(false);
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
    const total = pdf.numPages;
    setPageCount(total);
    const b64s: string[] = [];

    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      b64s.push(canvas.toDataURL('image/jpeg', 0.85).replace('data:image/jpeg;base64,', ''));
      setRenderProgress(i);
    }

    setPages(b64s);
    setBusy(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    renderPdf(file);
  };

  const BATCH = 5; // pages per request to stay under body size limit

  const extract = async () => {
    if (!storeId || !pages.length) {
      setMsg({ ok: false, text: 'Market seçin və PDF yükləyin.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    setExtractProgress(0);

    const allMatched: MatchedProduct[] = [];
    const allUnmatched: ExtractedProduct[] = [];
    let totalExtracted = 0;

    try {
      for (let i = 0; i < pages.length; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);
        const res = await fetch('/api/catalog-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ store_id: storeId, market_name: marketName, pages: batch }),
        });
        const text = await res.text();
        let j: { extracted?: number; matched?: MatchedProduct[]; unmatched?: ExtractedProduct[]; error?: string };
        try { j = JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
        if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
        totalExtracted += j.extracted ?? 0;
        allMatched.push(...(j.matched ?? []));
        allUnmatched.push(...(j.unmatched ?? []));
        setExtractProgress(Math.min(i + BATCH, pages.length));
      }

      setMatched(allMatched);
      setUnmatched(allUnmatched);
      setMsg({ ok: true, text: `${totalExtracted} məhsul çıxarıldı · ${allMatched.length} uyğunlaşdı · tətbiq edilir…` });
      // Applied straight away: every extracted row was going to be applied anyway,
      // and the checkbox pass in between only added a click. The table below stays
      // as the record of what was written.
      await applyPrices(allMatched, allUnmatched);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      setExtractProgress(0);
    }
  };

  const applyPrices = async (rows: MatchedProduct[], queue: ExtractedProduct[]) => {
    const items = rows.map((m) => ({ product_id: m.product_id, price: m.price, old_price: m.old_price ?? null }));
    setApplying(true);
    setMsg(null);
    try {
      const res = await fetch('/api/catalog-import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, items, unmatched: queue }),
      });
      const text = await res.text();
      let j: { updated?: number; pending?: number; error?: string };
      try { j = JSON.parse(text); } catch { throw new Error(text.slice(0, 120)); }
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: `${j.updated ?? 0} qiymət yeniləndi · ${j.pending ?? 0} yeni məhsul Növbəyə əlavə edildi` });
      setPages([]);
      setPageCount(0);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" async />
      <Shell title="Kataloq İmportu">
        {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>1. Kataloq seçin</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label className="label">Market</label>
              <select className="input" value={storeId} onChange={e => {
                setStoreId(e.target.value);
                setMarketName(stores.find(s => s.id === e.target.value)?.name ?? '');
              }}>
                <option value="">— seçin —</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">PDF Kataloq</label>
              <input ref={fileRef} type="file" accept=".pdf" onChange={handleFile} style={{ display: 'none' }} />
              <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload size={14} /> PDF seç
              </button>
            </div>
          </div>

          {pageCount > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} />
              <span style={{ fontSize: 13 }}>
                {renderProgress < pageCount
                  ? `Səhifə ${renderProgress}/${pageCount} render edilir…`
                  : `${pageCount} səhifə hazırdır`}
              </span>
              {renderProgress === pageCount && <CheckCircle size={14} color="#16A34A" />}
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>2. AI ilə çıxar</h2>
          <p className="muted" style={{ margin: '0 0 12px' }}>
            GPT-4o Vision hər kataloq səhifəsini oxuyur, məhsul adı, qiymət, endirim qiyməti çıxarır və bazada uyğunlaşdırır.
          </p>
          <button className="btn" onClick={extract} disabled={busy || !pages.length || !storeId}>
            {busy
              ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Səhifə {extractProgress}/{pageCount}…</>
              : 'Çıxar'}
          </button>
        </div>

        {matched.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ marginTop: 0, marginBottom: 12 }}>
              3. Tətbiq edildi ({matched.length} qiymət){applying ? ' — yazılır…' : ''}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Kataloqdakı ad</th>
                  <th>DB məhsulu</th>
                  <th style={{ textAlign: 'right' }}>Qiymət</th>
                  <th style={{ textAlign: 'right' }}>Köhnə qiymət</th>
                  <th style={{ textAlign: 'right' }}>Səhifə</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13 }}>{m.name}</td>
                    <td style={{ fontSize: 12, color: '#6B7280' }}>{m.product_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.price.toFixed(2)} ₼</td>
                    <td style={{ textAlign: 'right', color: '#9CA3AF', textDecoration: 'line-through', fontSize: 12 }}>
                      {m.old_price != null ? `${m.old_price.toFixed(2)} ₼` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#9CA3AF' }}>{m.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {unmatched.length > 0 && (
          <div className="card">
            <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <XCircle size={18} color="#DC2626" /> Uyğunlaşdırılmamış ({unmatched.length})
            </h2>
            <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              Bu məhsullar bazada tapılmadı. Məhsullar səhifəsindən əlavə edə bilərsiniz.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Ad</th>
                  <th style={{ textAlign: 'right' }}>Qiymət</th>
                  <th style={{ textAlign: 'right' }}>Köhnə qiymət</th>
                  <th style={{ textAlign: 'right' }}>Səhifə</th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((u, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 13 }}>{u.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{u.price.toFixed(2)} ₼</td>
                    <td style={{ textAlign: 'right', color: '#9CA3AF', fontSize: 12 }}>
                      {u.old_price != null ? `${u.old_price.toFixed(2)} ₼` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12, color: '#9CA3AF' }}>{u.page}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Shell>
    </>
  );
}

interface PdfjsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocument> };
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
}
