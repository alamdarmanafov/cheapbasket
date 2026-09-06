'use client';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { AdminUser, supabase } from '@/lib/supabase';

export default function Users() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');

  const load = async () => {
    const { data, error } = await supabase.rpc('admin_users_list');
    if (error) setMsg({ ok: false, text: error.message });
    setRows((data ?? []) as AdminUser[]);
  };
  useEffect(() => { load(); }, []);

  const setPlan = async (u: AdminUser, plan: 'free' | 'plus') => {
    const { error } = await supabase.from('profiles').upsert({ user_id: u.id, plan });
    setMsg({ ok: !error, text: error ? error.message : `${u.email}: ${plan.toUpperCase()}` });
    load();
  };
  const filtered = rows.filter((u) => `${u.email ?? ''} ${u.display_name ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('az-AZ') : '—');

  return (
    <Shell title="İstifadəçilər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar"><input placeholder="E-poçt və ya ad…" value={q} onChange={(e) => setQ(e.target.value)} /><span className="muted">{rows.length} istifadəçi · {rows.filter((r) => r.plan === 'plus').length} Plus</span></div>
      <table>
        <thead><tr><th>İstifadəçi</th><th>Giriş üsulu</th><th>Qeydiyyat</th><th>Son giriş</th><th>Plan</th><th></th></tr></thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id}>
              <td><b>{u.display_name ?? '—'}</b><br /><span className="muted">{u.email}</span></td>
              <td className="muted">{u.provider}</td>
              <td className="muted">{fmt(u.created_at)}</td>
              <td className="muted">{fmt(u.last_sign_in_at)}</td>
              <td><span className={`pill ${u.plan === 'plus' ? 'red' : 'gray'}`}>{u.plan.toUpperCase()}</span></td>
              <td style={{ textAlign: 'right' }}>
                {u.plan === 'plus' ? <button className="btn secondary" onClick={() => setPlan(u, 'free')}>Plus-ı bağla</button> : <button className="btn" onClick={() => setPlan(u, 'plus')}>Plus ver</button>}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 30 }}>İstifadəçi yoxdur.</td></tr>}
        </tbody>
      </table>
      <p className="note">Mağaza ödənişi (App Store / Google Play) qoşulanda plan avtomatik yenilənəcək; indi əl ilə idarə olunur.</p>
    </Shell>
  );
}
