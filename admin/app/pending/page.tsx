'use client';
import { useEffect, useState } from 'react';
import { normalizeGtin } from '@/lib/gtin';
import { CheckCircle, CheckCheck, Copy, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { useCategories } from '@/lib/supabase';

interface PendingProduct {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  size: string | null;
  image_url: string | null;
  category: string | null;
  store_id: string | null;
  source_name: string | null;
  created_at: string;
  /** Set when a shopper queued this from the scanner; approval pays them points. */
  suggested_by: string | null;
  suggested_at: string | null;
}

// ── Duplicate detection for pending ─────────────────────────────────────────
type PendingDupGroup = { key: string; kind: 'barcode' | 'name'; products: PendingProduct[] };

const normSlug = (s: string) =>
  s.toLowerCase()
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/[^a-z0-9]+/g, ' ').trim()
    .split(/\s+/).sort().join(' ');

function findPendingDuplicates(items: PendingProduct[]): PendingDupGroup[] {
  const groups: PendingDupGroup[] = [];
  const byBarcode = new Map<string, PendingProduct[]>();
  for (const p of items) {
    const bc = normalizeGtin(p.barcode);
    if (bc) {
      const arr = byBarcode.get(bc) ?? [];
      arr.push(p);
      byBarcode.set(bc, arr);
    }
  }
  for (const [bc, ps] of byBarcode) {
    if (ps.length > 1) groups.push({ key: `Barkod: ${bc}`, kind: 'barcode', products: ps });
  }
  const barcodeIds = new Set(groups.flatMap((g) => g.products.map((p) => p.id)));
  const byName = new Map<string, PendingProduct[]>();
  for (const p of items) {
    if (barcodeIds.has(p.id)) continue;
    const key = normSlug(`${p.brand ?? ''} ${p.name} ${p.size ?? ''}`);
    if (!key) continue;
    const arr = byName.get(key) ?? [];
    arr.push(p);
    byName.set(key, arr);
  }
  for (const [key, ps] of byName) {
    if (ps.length > 1) groups.push({ key: `Ad: ${key}`, kind: 'name', products: ps });
  }
  return groups;
}

export default function PendingPage() {
  const [items, setItems] = useState<PendingProduct[]>([]);
  const [cats, setCats] = useState<Record<string, string>>({});
  // Name and brand as the admin corrected them before approving. Shoppers type
  // what they see on the shelf, which is rarely the catalogue's spelling.
  const [names, setNames] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const { names: categories } = useCategories();

  // Duplicate detection state
  const [dupGroups, setDupGroups] = useState<PendingDupGroup[] | null>(null);
  const [dupKeep, setDupKeep] = useState<Record<string, string>>({});
  const [dupSelected, setDupSelected] = useState<Set<string>>(new Set());
  const [dupMerging, setDupMerging] = useState(false);
  const [dupProgress, setDupProgress] = useState<{ done: number; total: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pending');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setItems(j.data ?? []);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const api = async (body: unknown) => {
    const res = await fetch('/api/pending', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
    return j;
  };

  const approve = async (item: PendingProduct) => {
    setBusy(item.id);
    setMsg(null);
    try {
      const name = (names[item.id] ?? item.name).trim();
      const r = await api({ op: 'approve', id: item.id, category: cats[item.id] ?? item.category ?? '', name, brand: (brands[item.id] ?? item.brand ?? '').trim() });
      const paid = r.points ? ` Təklif edənə +${r.points} xal verildi.` : '';
      setMsg({ ok: !r.warning, text: `"${name}" məhsullar siyahısına əlavə edildi.${paid}${r.warning ? ` ${r.warning}` : ''}` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const reject = async (item: PendingProduct) => {
    if (!confirm(`"${item.name}" növbədən silinsin?`)) return;
    setBusy(item.id + '-del');
    setMsg(null);
    try {
      await api({ op: 'reject', id: item.id });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const approveAll = async () => {
    if (!confirm(`${items.length} məhsulun hamısı qəbul edilsin?`)) return;
    setBusy('all');
    setMsg(null);
    try {
      const r = await api({ op: 'approve_all' });
      setMsg({ ok: true, text: `${r.count} məhsul qəbul edildi.${r.rewarded ? ` ${r.rewarded} istifadəçiyə xal verildi.` : ''}${r.skipped ? ` ${r.skipped} sətir adsız olduğu üçün növbədə qaldı.` : ''}` });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const findDups = () => {
    const groups = findPendingDuplicates(items);
    setDupGroups(groups);
    const defaults: Record<string, string> = {};
    for (const g of groups) defaults[g.key] = g.products[0].id;
    setDupKeep(defaults);
    setDupSelected(new Set());
  };

  const deleteDupGroup = async (group: PendingDupGroup): Promise<{ deleted: number; error?: string }> => {
    const keepId = dupKeep[group.key];
    if (!keepId) return { deleted: 0 };
    const toDelete = group.products.filter((p) => p.id !== keepId);
    try {
      for (const p of toDelete) await api({ op: 'reject', id: p.id });
      return { deleted: toDelete.length };
    } catch (e) { return { deleted: 0, error: (e as Error).message }; }
  };

  const mergeSingleGroup = async (group: PendingDupGroup) => {
    const toDelete = group.products.filter((p) => p.id !== dupKeep[group.key]);
    if (!confirm(`"${group.key}" qrupunda ${toDelete.length} dublikat silinsin?`)) return;
    setBusy('dup');
    try {
      const { deleted, error } = await deleteDupGroup(group);
      if (error) throw new Error(error);
      setMsg({ ok: true, text: `${deleted} dublikat silindi` });
      const newItems = items.filter((i) => !toDelete.some((d) => d.id === i.id));
      setItems(newItems);
      const newGroups = findPendingDuplicates(newItems);
      setDupGroups(newGroups);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setBusy(null); }
  };

  const mergeBulkDups = async (groups: PendingDupGroup[]) => {
    if (!groups.length) return;
    const totalDups = groups.reduce((acc, g) => acc + g.products.length - 1, 0);
    if (!confirm(`${groups.length} qrupda ${totalDups} dublikat silinsin?`)) return;
    setDupMerging(true);
    setDupProgress({ done: 0, total: groups.length });
    let totalDeleted = 0;
    const errors: string[] = [];
    const deletedIds = new Set<string>();
    for (let i = 0; i < groups.length; i++) {
      const { deleted, error } = await deleteDupGroup(groups[i]);
      totalDeleted += deleted;
      if (error) errors.push(error);
      else groups[i].products.filter((p) => p.id !== dupKeep[groups[i].key]).forEach((p) => deletedIds.add(p.id));
      setDupProgress({ done: i + 1, total: groups.length });
    }
    const newItems = items.filter((i) => !deletedIds.has(i.id));
    setItems(newItems);
    const newGroups = findPendingDuplicates(newItems);
    setDupGroups(newGroups);
    setDupSelected(new Set());
    setDupMerging(false);
    setDupProgress(null);
    setMsg({ ok: !errors.length, text: errors.length ? `${totalDeleted} silindi, xəta: ${errors[0]}` : `${totalDeleted} dublikat silindi` });
  };

  const count = items.length;
  const title = count > 0 ? `Təsdiq növbəsi (${count})` : 'Təsdiq növbəsi';

  return (
    <Shell title={title}>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            Sinxronizasiya zamanı tapılan yeni məhsullar admin təsdiqini gözləyir. Kateqoriyanı seçib qəbul et, ya da sil.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {count > 1 && (
              <button className="btn ghost" disabled={!!busy} onClick={findDups}>
                <Copy size={14} /> Dublikatları tap
              </button>
            )}
            {count > 0 && (
              <button className="btn" disabled={busy === 'all'} onClick={approveAll}>
                <CheckCheck size={14} /> {busy === 'all' ? 'Qəbul edilir…' : `Hamısını qəbul et (${count})`}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="muted">Yüklənir…</p>
        ) : count === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>
            Növbə boşdur. Yeni məhsullar növbəti sinxronizasiyadan sonra burada görünəcək.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Şəkil</th>
                  <th>Məhsul</th>
                  <th>Kateqoriya</th>
                  <th>Mənbə</th>
                  <th>Tarix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8, background: '#F3F4F6', display: 'block' }}
                        />
                      ) : (
                        <div style={{ width: 48, height: 48, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                          📦
                        </div>
                      )}
                    </td>
                    <td>
                      {item.suggested_by ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <input
                            value={brands[item.id] ?? item.brand ?? ''}
                            onChange={(e) => setBrands((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Brend"
                            style={{ fontSize: 13, width: 110 }}
                          />
                          <input
                            value={names[item.id] ?? item.name}
                            onChange={(e) => setNames((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="Məhsulun adı"
                            style={{ fontSize: 13, minWidth: 200 }}
                          />
                        </div>
                      ) : (
                        <div style={{ fontWeight: 500 }}>
                          {item.brand && <span className="muted" style={{ marginRight: 4, fontWeight: 400 }}>{item.brand}</span>}
                          {item.name}
                        </div>
                      )}
                      {item.size && <div className="muted" style={{ fontSize: 12 }}>{item.size}</div>}
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                        {item.id}
                        {item.barcode && item.barcode !== item.id.replace(/^sug-/, '') ? ` · ${item.barcode}` : ''}
                      </div>
                      {item.suggested_by && (
                        <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E' }} title={`İstifadəçi: ${item.suggested_by}`}>
                          👤 İstifadəçi təklifi · qəbul edilsə +xal
                        </span>
                      )}
                    </td>
                    <td>
                      <select
                        value={cats[item.id] ?? item.category ?? ''}
                        onChange={(e) => setCats((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        style={{ fontSize: 13, minWidth: 140 }}
                      >
                        <option value="">— seç —</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      <div>{item.source_name ?? '—'}</div>
                      {item.store_id && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.store_id}</div>}
                    </td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleString('az-AZ')}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button
                        className="btn"
                        disabled={!!busy}
                        onClick={() => approve(item)}
                        style={{ marginRight: 4 }}
                        title="Məhsullar siyahısına əlavə et"
                      >
                        <CheckCircle size={14} /> {busy === item.id ? '…' : 'Qəbul et'}
                      </button>
                      <button
                        className="btn ghost"
                        disabled={!!busy}
                        onClick={() => reject(item)}
                        title="Növbədən sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* ── Pending duplicate detection modal ── */}
      {dupGroups !== null && (
        <div className="modal-bg" onClick={() => !dupMerging && setDupGroups(null)}>
          <div className="modal" style={{ width: 'min(860px,100%)', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Növbədə dublikatlar {dupGroups.length > 0 && <span className="pill gray" style={{ fontSize: 13, marginLeft: 6 }}>{dupGroups.length} qrup</span>}</h2>
              <button className="btn ghost" disabled={dupMerging} onClick={() => setDupGroups(null)}><X size={18} /></button>
            </div>
            {dupGroups.length === 0
              ? <p className="muted" style={{ textAlign: 'center', padding: 30 }}>Dublikat tapılmadı.</p>
              : <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={dupGroups.length > 0 && dupGroups.every((g) => dupSelected.has(g.key))}
                      ref={(el) => { if (el) el.indeterminate = dupSelected.size > 0 && !dupGroups.every((g) => dupSelected.has(g.key)); }}
                      onChange={() => {
                        const allSel = dupGroups.every((g) => dupSelected.has(g.key));
                        setDupSelected(allSel ? new Set() : new Set(dupGroups.map((g) => g.key)));
                      }}
                    />
                    <span style={{ fontSize: 13 }}>Hamısını seç</span>
                  </label>
                  {dupSelected.size > 0 && (
                    <button className="btn danger" disabled={dupMerging} onClick={() => mergeBulkDups(dupGroups.filter((g) => dupSelected.has(g.key)))}>
                      {dupMerging && dupProgress ? `Silinir… ${dupProgress.done}/${dupProgress.total}` : `Seçilənləri sil (${dupSelected.size})`}
                    </button>
                  )}
                  <button className="btn danger" disabled={dupMerging} style={{ marginLeft: 'auto' }} onClick={() => mergeBulkDups(dupGroups)}>
                    {dupMerging && dupProgress && dupSelected.size === 0 ? `Silinir… ${dupProgress.done}/${dupProgress.total}` : `Hamısını sil (${dupGroups.length})`}
                  </button>
                </div>
                {dupProgress && (
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, margin: '6px 0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#EF4444', borderRadius: 2, width: `${(dupProgress.done / dupProgress.total) * 100}%`, transition: 'width .2s' }} />
                  </div>
                )}
                {dupGroups.map((group) => (
                  <div key={group.key} style={{ marginTop: 16, border: `2px solid ${dupSelected.has(group.key) ? '#EF4444' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--accent-bg, #F0F9FF)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={dupSelected.has(group.key)}
                          onChange={() => setDupSelected((prev) => { const next = new Set(prev); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}
                        />
                        <b style={{ fontSize: 13 }}>{group.key}</b>
                        <span className="muted" style={{ fontSize: 11 }}>{group.products.length - 1} dublikat</span>
                      </label>
                      <button className="btn danger" disabled={!!busy || dupMerging} onClick={() => mergeSingleGroup(group)}>Sil</button>
                    </div>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>Saxla</th>
                          <th>Məhsul</th>
                          <th>Mənbə</th>
                          <th>Şəkil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.products.map((p) => (
                          <tr key={p.id} style={{ background: dupKeep[group.key] === p.id ? 'var(--accent-bg, #F0FDF4)' : undefined }}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name={`keep-${group.key}`}
                                checked={dupKeep[group.key] === p.id}
                                onChange={() => setDupKeep((prev) => ({ ...prev, [group.key]: p.id }))}
                              />
                            </td>
                            <td>
                              {p.brand && <span className="muted" style={{ marginRight: 4 }}>{p.brand}</span>}
                              <b>{p.name}</b> <span className="muted">{p.size}</span>
                              <div className="muted" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.id}</div>
                            </td>
                            <td className="muted" style={{ fontSize: 12 }}>{p.source_name ?? '—'}</td>
                            <td>
                              {p.image_url
                                ? <img src={p.image_url} alt="" width={34} height={34} style={{ borderRadius: 6, objectFit: 'cover' }} />
                                : <span className="muted" style={{ fontSize: 11 }}>yoxdur</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </>}
          </div>
        </div>
      )}
    </Shell>
  );
}
