'use client';
import { useEffect, useMemo, useState } from 'react';
import { Ban, CalendarPlus, Search, Star, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { AdminUser, IapEvent, db } from '@/lib/supabase';
import { PaymentSummary, isPaidEvent, isRefundEvent, summarise } from '@/lib/iapEvents';

const DAY = 86400000;
const PRESETS = [7, 30, 90, 365];

async function usersApi(body: Record<string, unknown>) {
  const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? 'Xəta');
  return j;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('az-AZ') : '—');
const isActivePlus = (u: AdminUser) => u.plan === 'plus' && (!u.plan_expires_at || new Date(u.plan_expires_at) > new Date());
const daysLeft = (u: AdminUser) => (u.plan_expires_at ? Math.ceil((new Date(u.plan_expires_at).getTime() - Date.now()) / DAY) : null);

export default function Users() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'plus' | 'free' | 'expiring' | 'blocked'>('all');
  const [grant, setGrant] = useState<{ user: AdminUser; days: number | null; custom: string; note: string } | null>(null);
  /** per-row "extend by N days" input (user id → text) */
  const [extend, setExtend] = useState<Record<string, string>>({});
  /** user id → purchases, renewals and refunds, from iap_events */
  const [pay, setPay] = useState<Map<string, PaymentSummary>>(new Map());
  const [payFor, setPayFor] = useState<AdminUser | null>(null);

  const load = async () => {
    const data = await db.select<AdminUser>('admin_users', { order: 'created_at', fetchAll: true }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return []; });
    setRows([...data].reverse());
    const events = await db
      .select<IapEvent>('iap_events', { order: 'created_at', fetchAll: true })
      .catch(() => [] as IapEvent[]);
    setPay(summarise(events));
  };
  useEffect(() => { load(); }, []);

  const run = async (body: Record<string, unknown>, okText: string) => {
    try {
      await usersApi(body);
      setMsg({ ok: true, text: okText });
      load();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  const stats = useMemo(() => ({
    total: rows.length,
    plus: rows.filter(isActivePlus).length,
    expiring: rows.filter((u) => isActivePlus(u) && (daysLeft(u) ?? 99) <= 7).length,
    week: rows.filter((u) => Date.now() - new Date(u.created_at).getTime() < 7 * DAY).length,
    blocked: rows.filter((u) => u.blocked).length,
    paying: [...pay.values()].filter((p) => p.paid > 0).length,
    payments: [...pay.values()].reduce((n, p) => n + p.paid, 0),
  }), [rows, pay]);

  const filtered = rows.filter((u) => {
    const text = `${u.email ?? ''} ${u.display_name ?? ''}`.toLowerCase().includes(q.toLowerCase());
    if (!text) return false;
    if (filter === 'plus') return isActivePlus(u);
    if (filter === 'free') return !isActivePlus(u);
    if (filter === 'expiring') return isActivePlus(u) && (daysLeft(u) ?? 99) <= 7;
    if (filter === 'blocked') return u.blocked;
    return true;
  });

  return (
    <Shell title="İstifadəçilər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        {[['Cəmi', stats.total, 'all'], ['Aktiv Plus', stats.plus, 'plus'], ['Ödəniş edən', stats.paying, 'plus'], ['Cəmi ödənişli dövr', stats.payments, 'all'], ['7 gündə bitir', stats.expiring, 'expiring'], ['Bu həftə qeydiyyat', stats.week, 'all']].map(([l, n, f]) => (
          <button key={l as string} className="card stat" style={{ textAlign: 'left', cursor: 'pointer', border: filter === f ? '1.5px solid #E53935' : undefined }} onClick={() => setFilter(f as typeof filter)}>
            <b>{n as number}</b><small>{l as string}</small>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <Search size={16} className="muted" />
        <input placeholder="E-poçt və ya ad…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Hamısı</option><option value="plus">Plus</option><option value="free">Free</option><option value="expiring">7 gündə bitir</option><option value="blocked">Bloklanmış ({stats.blocked})</option>
        </select>
      </div>
      <table>
        <thead><tr><th>İstifadəçi</th><th>Giriş</th><th>Qeydiyyat</th><th>Son giriş</th><th>Cihaz</th><th>Ödəniş</th><th>Plan</th><th></th></tr></thead>
        <tbody>
          {filtered.map((u) => {
            const active = isActivePlus(u);
            const left = daysLeft(u);
            return (
              <tr key={u.id} style={u.blocked ? { opacity: 0.55 } : undefined}>
                <td><b>{u.display_name ?? '—'}</b>{u.blocked && <span className="pill red" style={{ marginLeft: 6 }}>BLOK</span>}<br /><span className="muted">{u.email}</span>{u.plan_note && <><br /><span className="muted" style={{ fontSize: 11 }}>📝 {u.plan_note}</span></>}</td>
                <td className="muted">{u.provider}</td>
                <td className="muted">{fmt(u.created_at)}</td>
                <td className="muted">{fmt(u.last_sign_in_at)}</td>
                <td>
                  {(() => {
                    const p = pay.get(u.id);
                    if (!p?.paid) return <span className="muted">—</span>;
                    return (
                      <button
                        className="pill green"
                        style={{ border: 0, cursor: 'pointer' }}
                        onClick={() => setPayFor(u)}
                        title={`Son ödəniş: ${fmt(p.last)}${p.refunds ? ` · ${p.refunds} geri qaytarma` : ''}`}
                      >
                        {p.paid}× {p.platform === 'apple' ? 'Apple' : p.platform === 'google' ? 'Google' : ''}
                        {p.refunds > 0 && ` · ↩${p.refunds}`}
                      </button>
                    );
                  })()}
                </td>
                <td className="muted">{u.devices ?? 0}</td>
                <td>
                  {active ? (
                    <><span className="pill red">PLUS</span><br /><span className="muted" style={{ fontSize: 11 }}>{left == null ? 'limitsiz' : `${left} gün qalıb · ${fmt(u.plan_expires_at)}`}</span></>
                  ) : (
                    <><span className="pill gray">FREE</span>{u.plan === 'plus' && <><br /><span className="muted" style={{ fontSize: 11 }}>bitib {fmt(u.plan_expires_at)}</span></>}</>
                  )}
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {active ? (
                    <>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Neçə gün artırılsın">
                        <input
                          type="number"
                          min={1}
                          placeholder="gün"
                          value={extend[u.id] ?? ''}
                          onChange={(e) => setExtend({ ...extend, [u.id]: e.target.value })}
                          onKeyDown={(e) => { const d = Number(extend[u.id]); if (e.key === 'Enter' && d > 0) { run({ op: 'extend', user_id: u.id, days: d }, `${u.email}: +${d} gün`); setExtend({ ...extend, [u.id]: '' }); } }}
                          style={{ width: 64, padding: '6px 8px' }}
                        />
                        <button
                          className="btn secondary"
                          disabled={!(Number(extend[u.id]) > 0)}
                          onClick={() => { const d = Number(extend[u.id]); run({ op: 'extend', user_id: u.id, days: d }, `${u.email}: +${d} gün → ${new Date(Math.max(Date.now(), new Date(u.plan_expires_at ?? 0).getTime()) + d * DAY).toLocaleDateString('az-AZ')}`); setExtend({ ...extend, [u.id]: '' }); }}
                        >
                          <CalendarPlus size={14} /> {Number(extend[u.id]) > 0 ? `+${Number(extend[u.id])} gün` : 'Artır'}
                        </button>
                      </span>{' '}
                      <button className="btn secondary" onClick={() => run({ op: 'plan', user_id: u.id, plan: 'free' }, `${u.email}: Plus bağlandı`)}>Bağla</button>
                    </>
                  ) : (
                    <button className="btn" onClick={() => setGrant({ user: u, days: 30, custom: '', note: '' })}><Star size={14} /> Plus ver</button>
                  )}{' '}
                  <button className="btn ghost" title={u.blocked ? 'Blokdan çıxar' : 'Blokla'} onClick={() => run({ op: 'block', user_id: u.id, blocked: !u.blocked }, u.blocked ? 'Blokdan çıxarıldı' : 'Bloklandı')}><Ban size={14} /></button>
                  <button className="btn ghost" title="Sil" onClick={() => { if (confirm(`${u.email} tamamilə silinsin? Səbəti, profili, cihazları da silinir.`)) run({ op: 'delete', user_id: u.id }, 'İstifadəçi silindi'); }}><Trash2 size={14} /></button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 30 }}>İstifadəçi yoxdur.</td></tr>}
        </tbody>
      </table>
      <p className="note">Müddət bitəndə tətbiq avtomatik Free-yə qayıdır. Mağaza ödənişi (App Store / Google Play) qoşulanda plan avtomatik yenilənəcək.</p>

      {grant && (
        <div className="modal-bg" onClick={() => setGrant(null)}>
          <div className="modal" style={{ width: 460 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>Plus ver</h2>
              <button className="btn ghost" onClick={() => setGrant(null)}><X size={18} /></button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>{grant.user.display_name ?? ''} · {grant.user.email}</p>
            <label>Müddət</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {PRESETS.map((d) => <button key={d} className={`btn ${grant.days === d ? '' : 'secondary'}`} onClick={() => setGrant({ ...grant, days: d, custom: '' })}>{d} gün</button>)}
              <button className={`btn ${grant.days === null ? '' : 'secondary'}`} onClick={() => setGrant({ ...grant, days: null, custom: '' })}>Limitsiz</button>
            </div>
            <label style={{ marginTop: 12 }}>Və ya gün sayı<input type="number" min={1} placeholder="məs. 14" value={grant.custom} onChange={(e) => setGrant({ ...grant, custom: e.target.value, days: e.target.value ? Number(e.target.value) : 30 })} /></label>
            <label style={{ marginTop: 12 }}>Qeyd (istəyə görə)<input placeholder="Kampaniya, hədiyyə, test…" value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} /></label>
            <p className="note">{grant.days ? `Bitmə: ${new Date(Date.now() + grant.days * DAY).toLocaleDateString('az-AZ')}` : 'Bitmə tarixi yoxdur'}</p>
            <div className="actions">
              <button className="btn secondary" onClick={() => setGrant(null)}>Ləğv et</button>
              <button className="btn" onClick={() => { run({ op: 'plan', user_id: grant.user.id, plan: 'plus', days: grant.days, note: grant.note || null }, `${grant.user.email}: Plus ${grant.days ? grant.days + ' gün' : 'limitsiz'}`); setGrant(null); }}>Təsdiqlə</button>
            </div>
          </div>
        </div>
      )}
      {payFor && (
        <PaymentHistory user={payFor} summary={pay.get(payFor.id)} onClose={() => setPayFor(null)} />
      )}
    </Shell>
  );
}

/** Every store event recorded for one user, newest first. */
function PaymentHistory({ user, summary, onClose }: { user: AdminUser; summary?: PaymentSummary; onClose: () => void }) {
  const events = summary?.events ?? [];
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Ödəniş tarixçəsi</h2>
          <button className="btn ghost" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          {user.display_name ?? user.email} · <b>{summary?.paid ?? 0}</b> ödənişli dövr
          {summary?.refunds ? ` · ${summary.refunds} geri qaytarma` : ''}
        </p>

        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid #eee', borderRadius: 8, marginTop: 12 }}>
          <table>
            <thead><tr><th>Tarix</th><th>Platforma</th><th>Hadisə</th><th>Məhsul</th><th>Bitmə</th></tr></thead>
            <tbody>
              {events.map((e) => {
                const paid = isPaidEvent(e.event);
                const refund = isRefundEvent(e.event);
                return (
                  <tr key={e.id}>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(e.created_at)}</td>
                    <td className="muted">{e.platform}</td>
                    <td>
                      <span className={`pill ${paid ? 'green' : refund ? 'red' : 'gray'}`}>{e.event}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.product_id ?? '—'}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{e.expires_at ? fmt(e.expires_at) : '—'}</td>
                  </tr>
                );
              })}
              {events.length === 0 && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 24 }}>Bu istifadəçi üçün ödəniş qeydi yoxdur.</td></tr>}
            </tbody>
          </table>
        </div>

        <p className="note">
          Yalnız yaşıl sətirlər ödənişli dövr sayılır: ilk alış, avtomatik yenilənmə və yenidən abunə olma.
          “verify” tətbiq hər açılanda və “alışları bərpa et” basılanda da yazılır, ona görə ödəniş kimi sayılmır.
        </p>

        <div className="actions">
          <button className="btn secondary" onClick={onClose}>Bağla</button>
        </div>
      </div>
    </div>
  );
}
