'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

interface Counts { stores: number; products: number; prices: number; branches: number }
interface Analytics {
  users: { total: number; new7: number; new30: number; active7: number; activeToday: number; devices: number };
  plus: { active: number; conversion: number; bySource: Record<string, number>; purchases30: number; promos30: number };
  days: Array<{ day: string; active: number; new: number; scans: number; compares: number }>;
  byKind: Record<string, { d7: number; d30: number }>;
  topBasket: Array<{ id: string; name: string; n: number }>;
  topScanned: Array<{ id: string; name: string; n: number }>;
  bestStores: Array<{ id: string; store: { name: string; color: string; initial: string } | undefined; n: number }>;
  topMissing: Array<{ q: string; n: number }>;
  compareStats: { count30: number; savingAvg: number };
  feedbackNew: number;
}
interface StoreCoverage { id: string; name: string; color: string; covered: number; total: number }
interface SyncResult { ok: boolean; found: number; updated: number; error?: string }
interface SyncSource { id: string; store_id: string; name: string | null; last_run_at: string | null; last_result: SyncResult | null }
interface DashStats {
  totalProducts: number;
  productsWithPrice: number;
  productsWithoutPrice: number;
  totalBranches: number;
  totalUsers: number;
  totalPlus: number;
  storeCoverage: StoreCoverage[];
  recentSyncs: SyncSource[];
}

const KIND_LABEL: Record<string, string> = { app_open: 'Tətbiq açılışı', search: 'Axtarış', scan: 'Barkod skan', photo: 'Şəkillə tanıma (AI)', basket_add: 'Səbətə əlavə', compare: 'Qiymət müqayisəsi', map_open: 'Xəritə açılışı', promo: 'Promo kod', plus_view: 'Plus səhifəsinə baxış', plus_buy: 'Plus — alış başladı', plus_purchase: 'Plus — alış tamamlandı', plus_restore: 'Plus — bərpa edildi', plus_fail: 'Plus — alış baş tutmadı' };

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Dashboard() {
  const [c, setC] = useState<Counts | null>(null);
  const [a, setA] = useState<Analytics | null>(null);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const count = (t: string) => Promise.race([db.count(t), new Promise<number>((_, rej) => setTimeout(() => rej(new Error(`${t}: 10 s ərzində cavab gəlmədi`)), 10000))]).catch((e: Error) => { setErr(e.message); return -1; });
    const [stores, products, prices, branches] = await Promise.all([count('stores'), count('products'), count('prices'), count('branches')]);
    setC({ stores, products, prices, branches });

    const [aRes, dRes] = await Promise.all([
      fetch('/api/analytics').then((x) => x.json()).catch((e: Error) => ({ error: e.message })),
      fetch('/api/dashboard').then((x) => x.json()).catch((e: Error) => ({ error: e.message })),
    ]);
    if (aRes.error) setErr(aRes.error); else setA(aRes);
    if (!dRes.error) setStats(dRes);
  };

  useEffect(() => { load(); }, []);
  const n = (v: number | undefined) => (v == null ? '…' : v < 0 ? '?' : v);
  const maxActive = Math.max(1, ...(a?.days.map((d) => d.active) ?? [1]));

  return (
    <Shell title="Panel">
      {err && <div className="alert err">{err} — Vercel-də SUPABASE_SERVICE_ROLE_KEY və NEXT_PUBLIC_SUPABASE_URL dəyişənlərini yoxla; analitika üçün 0016 migrasiyası işlənməlidir.</div>}

      {/* ─── Stats row ─── */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {[
          ['Cəmi məhsul', stats?.totalProducts, '/products'],
          ['Qiymətli məhsul', stats?.productsWithPrice, '/prices'],
          ['Qiymətsiz məhsul', stats?.productsWithoutPrice, '/prices'],
          ['Filiallar', stats?.totalBranches, '/branches'],
          ['İstifadəçi (cəmi)', stats?.totalUsers, '/users'],
          ['Aktiv Plus', stats?.totalPlus, '/users'],
          ['Aktiv Plus (analitika)', a?.plus.active, '/users'],
          ['Yeni rəy', a?.feedbackNew, '/feedback'],
        ].map(([label, v, href]) => (
          <Link key={label as string} href={href as string} className="card stat">
            <b>{v == null ? '…' : (v as number | string)}</b>
            <small>{label}</small>
          </Link>
        ))}
      </div>

      {/* ─── Price coverage per store ─── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Mağaza üzrə qiymət əhatəsi</h2>
        {!stats ? (
          <p className="muted">Yüklənir…</p>
        ) : stats.storeCoverage.length === 0 ? (
          <p className="muted">Mağaza tapılmadı</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {stats.storeCoverage.map((s) => {
              const pct = s.total > 0 ? Math.round((s.covered / s.total) * 100) : 0;
              return (
                <div key={s.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: s.color, marginRight: 8, verticalAlign: 'middle' }} />
                      {s.name}
                    </span>
                    <span className="muted" style={{ fontSize: 13 }}>{s.covered} / {s.total} məhsul &nbsp;<b style={{ color: '#171717' }}>{pct}%</b></span>
                  </div>
                  <div style={{ height: 8, background: '#F1F1F3', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 4, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
        {/* ─── Recent sync runs ─── */}
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Son sinxronizasiyalar</h2>
          {!stats ? (
            <p className="muted">Yüklənir…</p>
          ) : stats.recentSyncs.length === 0 ? (
            <p className="muted">Hələ sinxronizasiya yoxdur</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mənbə</th>
                  <th>Vaxt</th>
                  <th>Nəticə</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSyncs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name ?? s.store_id}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(s.last_run_at)}</td>
                    <td>
                      {s.last_result ? (
                        s.last_result.ok ? (
                          <span className="pill green">+{s.last_result.updated ?? 0} yeniləndi</span>
                        ) : (
                          <span className="pill red" title={s.last_result.error}>Xəta</span>
                        )
                      ) : (
                        <span className="pill gray">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ─── Quick links ─── */}
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Sürətli keçidlər</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['/import', '⬇️ Import', 'Saytdan məhsul import et'],
              ['/sync', '🔄 Sinxronizasiya', 'Avtomatik yeniləmə idarəsi'],
              ['/branches', '📍 Filiallar', 'Mağaza filiallarını idarə et'],
              ['/products', '📦 Məhsullar', 'Məhsul siyahısı'],
              ['/prices', '💰 Qiymətlər', 'Bütün mağazaların qiymət cədvəli'],
              ['/users', '👤 İstifadəçilər', 'İstifadəçiləri idarə et'],
            ].map(([href, title, desc]) => (
              <Link key={href as string} href={href as string} className="card" style={{ padding: '12px 14px', cursor: 'pointer' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Analytics row (existing) ─── */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', marginTop: 8, alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Son 14 gün · aktiv istifadəçi</h2>
          {!a ? <p className="muted">Yüklənir…</p> : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
              {a.days.map((d) => (
                <div key={d.day} title={`${d.day}: ${d.active} aktiv · ${d.new} yeni · ${d.scans} skan · ${d.compares} müqayisə`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span className="muted" style={{ fontSize: 11 }}>{d.active}</span>
                  <div style={{ width: '100%', height: Math.max(3, (d.active / maxActive) * 100), background: '#E53935', borderRadius: 6, opacity: 0.85 }} />
                  <span className="muted" style={{ fontSize: 10 }}>{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Hərəkət</th><th style={{ textAlign: 'right' }}>7 gün</th><th style={{ textAlign: 'right' }}>30 gün</th></tr></thead>
            <tbody>
              {a && Object.entries(a.byKind).map(([k, v]) => <tr key={k}><td>{KIND_LABEL[k] ?? k}</td><td style={{ textAlign: 'right' }}>{v.d7}</td><td style={{ textAlign: 'right' }}>{v.d30}</td></tr>)}
            </tbody>
          </table>
          {a && <p className="note">Müqayisə · 30 gün: {a.compareStats.count30} dəfə, orta qənaət {a.compareStats.savingAvg.toFixed(2)} ₼. Plus mənbələri: Apple {a.plus.bySource.apple ?? 0} · Google {a.plus.bySource.google ?? 0} · Promo {a.plus.bySource.promo ?? 0} · Əl ilə {a.plus.bySource.manual ?? 0}. Promo istifadəsi · 30 gün: {a.plus.promos30}.</p>}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <Top title="Ən çox səbətə atılan" rows={a?.topBasket.map((r) => [r.name, r.n])} empty="Hələ məlumat yoxdur" />
          <Top title="Ən çox skan olunan" rows={a?.topScanned.map((r) => [r.name, r.n])} empty="Hələ skan yoxdur" />
          <Top title="Ən çox 'ən sərfəli' çıxan market" rows={a?.bestStores.map((r) => [r.store?.name ?? r.id, r.n])} empty="Hələ müqayisə yoxdur" />
          <Top title="Tapılmayan axtarışlar (məhsul əlavə et)" rows={a?.topMissing.map((r) => [r.q, r.n])} empty="Yoxdur" />
        </div>
      </div>

      <div className="grid cols-4" style={{ marginTop: 16 }}>
        {[['Marketlər', c?.stores, '/stores'], ['Məhsullar', c?.products, '/products'], ['Qiymət sətirləri', c?.prices, '/prices'], ['Filiallar', c?.branches, '/branches']].map(([label, v, href]) => (
          <Link key={label as string} href={href as string} className="card stat"><b>{n(v as number | undefined)}</b><small>{label}</small></Link>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><button className="btn secondary" onClick={load}>Yenilə</button></div>
    </Shell>
  );
}

function Top({ title, rows, empty }: { title: string; rows?: Array<[string, number]>; empty: string }) {
  const max = Math.max(1, ...(rows?.map((r) => r[1]) ?? [1]));
  return (
    <div className="card" style={{ padding: 16 }}>
      <b>{title}</b>
      {!rows ? <p className="muted" style={{ margin: '6px 0 0' }}>Yüklənir…</p> : rows.length === 0 ? <p className="muted" style={{ margin: '6px 0 0' }}>{empty}</p> : (
        <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
          {rows.map(([label, v]) => (
            <div key={label} style={{ fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span><b>{v}</b></div>
              <div style={{ height: 4, background: '#F1F1F3', borderRadius: 2, marginTop: 3 }}><div style={{ width: `${(v / max) * 100}%`, height: 4, background: '#E53935', borderRadius: 2 }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
