'use client';
import { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle, Clock, HelpCircle, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Pager, usePager } from '@/components/Pager';
import { db } from '@/lib/supabase';

interface AiLog {
  id: string;
  query_name: string;
  query_barcode: string | null;
  matched_product_id: string | null;
  confidence: number;
  status: 'matched' | 'review' | 'rejected';
  reason: string;
  created_at: string;
}

export default function AiPage() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const { page, setPage, totalPages, paged } = usePager(logs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.select<AiLog>('ai_logs', { order: 'created_at', limit: 200 })
      .then((rows) => setLogs(rows.reverse())
      )
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = logs.length;
  const matched = logs.filter((l) => l.status === 'matched').length;
  const review = logs.filter((l) => l.status === 'review').length;
  const rejected = logs.filter((l) => l.status === 'rejected').length;
  const avgConf = total ? Math.round(logs.reduce((a, l) => a + l.confidence, 0) / total) : 0;

  const statusIcon = (s: AiLog['status']) => {
    if (s === 'matched') return <CheckCircle size={14} style={{ color: '#16A34A' }} />;
    if (s === 'review') return <HelpCircle size={14} style={{ color: '#D97706' }} />;
    return <XCircle size={14} style={{ color: '#DC2626' }} />;
  };

  return (
    <Shell title="AI Aktivliyi">
      {error && <div className="alert err">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cəmi sorğu', value: total, icon: <BrainCircuit size={20} />, color: '#2563EB' },
          { label: 'Uyğun', value: matched, icon: <CheckCircle size={20} />, color: '#16A34A' },
          { label: 'Nəzərdən keçirilməli', value: review, icon: <HelpCircle size={20} />, color: '#D97706' },
          { label: 'Uyğun tapılmadı', value: rejected, icon: <XCircle size={20} />, color: '#DC2626' },
          { label: 'Orta inam', value: `${avgConf}%`, icon: <Clock size={20} />, color: '#7C3AED' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ margin: 0, padding: '14px 16px' }}>
            <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{loading ? '…' : s.value}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Confidence distribution */}
      {!loading && total > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>İnam paylanması</h2>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
            {Array.from({ length: 10 }, (_, i) => {
              const lo = i * 10, hi = lo + 10;
              const count = logs.filter((l) => l.confidence >= lo && l.confidence < hi + (i === 9 ? 1 : 0)).length;
              const pct = total ? (count / total) * 100 : 0;
              const color = lo >= 90 ? '#16A34A' : lo >= 70 ? '#D97706' : '#DC2626';
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>{count || ''}</div>
                  <div style={{ width: '100%', background: color, height: `${Math.max(pct * 0.6, pct > 0 ? 4 : 0)}px`, borderRadius: 3 }} />
                  <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lo}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11 }}>
            <span style={{ color: '#16A34A' }}>■ ≥90 avtomatik</span>
            <span style={{ color: '#D97706' }}>■ 70–89 nəzərdən keçirilməli</span>
            <span style={{ color: '#DC2626' }}>■ &lt;70 rədd</span>
          </div>
        </div>
      )}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Son 200 AI sorğu</h2>
        {loading ? (
          <p className="muted">Yüklənir…</p>
        ) : logs.length === 0 ? (
          <p className="muted">Hələ AI sorğusu yoxdur. "AI eşləşdirmə" düyməsi ilə başla.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Məhsul adı</th>
                  <th>Barkod</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>İnam</th>
                  <th>Səbəb</th>
                  <th>Tarix</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 13 }}>{l.query_name}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{l.query_barcode ?? '—'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        {statusIcon(l.status)}
                        {l.status === 'matched' ? 'Uyğun' : l.status === 'review' ? 'Nəzərdən keçir' : 'Rədd'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                      <span style={{ color: l.confidence >= 90 ? '#16A34A' : l.confidence >= 70 ? '#D97706' : '#DC2626' }}>
                        {l.confidence}%
                      </span>
                    </td>
                    <td className="muted" style={{ fontSize: 12, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.reason}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString('az-AZ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} setPage={setPage} totalPages={totalPages} total={logs.length} unit="qeyd" />
          </div>
        )}
      </div>
    </Shell>
  );
}
