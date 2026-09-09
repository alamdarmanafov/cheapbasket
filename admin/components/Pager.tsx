'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Rows per page across every admin list. */
export const PAGE_SIZE = 50;

/**
 * Slices a list into pages of fifty.
 *
 * Filtering is what usually changes the list, and a filter that leaves fewer
 * pages than the one being viewed would otherwise show an empty table, so the
 * page is clamped on read and reset whenever the row count changes.
 */
export function usePager<T>(rows: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(page, totalPages);
  useEffect(() => { setPage(1); }, [rows.length]);
  const paged = useMemo(() => rows.slice((safePage - 1) * size, safePage * size), [rows, safePage, size]);
  return { page: safePage, setPage, totalPages, paged, size, total: rows.length };
}

/**
 * The page strip: first, previous, a window of numbers around the current page,
 * next, last, the range being shown, and a box to jump to a page by number.
 * Hidden when everything fits on one page; a plain count is shown instead.
 */
export function Pager({ page, setPage, totalPages, total, size = PAGE_SIZE, unit = 'sətir' }: {
  page: number;
  setPage: (n: number | ((p: number) => number)) => void;
  totalPages: number;
  total: number;
  size?: number;
  unit?: string;
}) {
  if (totalPages <= 1) {
    return total > 0 ? <p className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '8px 0' }}>{total} {unit}</p> : null;
  }
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce<(number | '…')[]>((acc, p, i, arr) => {
      if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
      acc.push(p);
      return acc;
    }, []);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', flexWrap: 'wrap' }}>
      <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(1)} title="İlk səhifə">«</button>
      <button className="btn ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /></button>
      {numbers.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--muted)' }}>…</span>
          : <button key={p} className={`btn${page === p ? '' : ' ghost'}`} onClick={() => setPage(p as number)} style={{ minWidth: 34 }}>{p}</button>
      )}
      <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight size={15} /></button>
      <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage(totalPages)} title="Son səhifə">»</button>
      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
        {(page - 1) * size + 1}–{Math.min(page * size, total)} / {total} {unit}
      </span>
      <span className="muted" style={{ fontSize: 12 }}>· Səhifə:</span>
      <input
        type="number"
        min={1}
        max={totalPages}
        value={page}
        onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
        style={{ width: 56, textAlign: 'center' }}
      />
      <span className="muted" style={{ fontSize: 12 }}>/ {totalPages}</span>
    </div>
  );
}
