'use client';
import { useState } from 'react';
import { CheckCircle, ExternalLink, Play, RefreshCw, XCircle } from 'lucide-react';
import { Shell } from '@/components/Shell';

interface ProviderResult {
  market: string;
  name: string;
  url: string;
  ok: boolean;
  items: number;
  venue?: string;
  ms?: number;
  error?: string;
}

const PROVIDERS = [
  { market: 'araz', name: 'Araz', url: 'https://wolt.com/az/aze/baku/venue/araz' },
  { market: 'bazarstore', name: 'BazarStore', url: 'https://wolt.com/az/aze/baku/venue/bazarstore' },
  { market: 'bravo', name: 'Bravo', url: 'https://wolt.com/az/aze/baku/venue/bravo-supermarket' },
  { market: 'neptun', name: 'Neptun', url: 'https://wolt.com/az/aze/baku/venue/neptun' },
  { market: 'oba', name: 'OBA', url: 'https://wolt.com/az/aze/baku/venue/oba-market' },
  { market: 'spar', name: 'SPAR', url: 'https://wolt.com/az/aze/baku/venue/spar-azerbaijan' },
  { market: 'tamstore', name: 'Tam Store', url: 'https://wolt.com/az/aze/baku/venue/tam-store' },
];

export default function ProvidersPage() {
  const [results, setResults] = useState<Record<string, ProviderResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const testOne = async (market: string) => {
    setTesting((t) => ({ ...t, [market]: true }));
    try {
      const res = await fetch(`/api/providers/test?market=${market}`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const r = j.results[0] as ProviderResult;
      setResults((prev) => ({ ...prev, [market]: r }));
    } catch (e) {
      setResults((prev) => ({ ...prev, [market]: { market, name: market, url: '', ok: false, items: 0, error: (e as Error).message } }));
    } finally {
      setTesting((t) => ({ ...t, [market]: false }));
    }
  };

  const testAll = async () => {
    setTestingAll(true);
    setMsg(null);
    const settled = await Promise.allSettled(PROVIDERS.map((p) => testOne(p.market)));
    const failed = settled.filter((r) => r.status === 'rejected').length;
    setMsg({ ok: failed === 0, text: `${PROVIDERS.length} provider yoxlanıldı${failed ? ` · ${failed} xəta` : ' · hamısı OK'}` });
    setTestingAll(false);
  };

  return (
    <Shell title="Wolt Provider yoxlaması">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>Wolt slugları</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Hər market üçün Wolt API-dan məhsul çəkilməsini yoxla. Xəta varsa URL-i <a href="/sync">Avtomatik yeniləmə</a> səhifəsindən yenilə.
            </p>
          </div>
          <button className="btn" disabled={testingAll} onClick={testAll}>
            <RefreshCw size={14} style={testingAll ? { animation: 'spin 1s linear infinite' } : {}} />
            {testingAll ? 'Yoxlanılır…' : 'Hamısını yoxla'}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Market</th>
              <th>Wolt slug</th>
              <th style={{ textAlign: 'right' }}>Məhsul sayı</th>
              <th style={{ textAlign: 'right' }}>Vaxt</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((p) => {
              const r = results[p.market];
              const busy = testing[p.market];
              return (
                <tr key={p.market}>
                  <td><b>{p.name}</b></td>
                  <td>
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.url.replace('https://wolt.com/az/aze/baku/venue/', '…/')}
                      <ExternalLink size={11} />
                    </a>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {r ? (r.ok ? r.items.toLocaleString() : '—') : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 12 }} className="muted">
                    {r?.ms != null ? `${(r.ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td>
                    {busy ? (
                      <span style={{ fontSize: 12, color: '#2563EB', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Yoxlanılır…
                      </span>
                    ) : r ? (
                      r.ok ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16A34A', fontSize: 12 }}>
                          <CheckCircle size={14} /> OK · {r.venue}
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#DC2626', fontSize: 12 }} title={r.error}>
                          <XCircle size={14} /> {r.error?.slice(0, 60)}
                        </span>
                      )
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>yoxlanılmayıb</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost" disabled={busy || testingAll} onClick={() => testOne(p.market)}>
                      <Play size={12} /> Test et
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
