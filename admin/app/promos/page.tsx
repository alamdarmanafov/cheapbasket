'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

interface Promo { code: string; days: number; max_uses: number | null; used: number; expires_at: string | null; active: boolean; note: string | null; created_at: string }
const rand = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export default function Promos() {
  const [rows, setRows] = useState<Promo[]>([]);
  const [draft, setDraft] = useState({ code: '', days: '30', max_uses: '', expires_at: '', note: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = async () => setRows(await db.select<Promo>('promo_codes', { order: 'created_at' }).then((r) => r.reverse()).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return []; }));
  useEffect(() => { load(); }, []);

  const add = async () => {
    const code = draft.code.trim().toUpperCase().replace(/\s+/g, '');
    const days = Number(draft.days);
    if (!code || !(days > 0)) { setMsg({ ok: false, text: 'Kod və gün sayı lazımdır' }); return; }
    const row = { code, days, max_uses: draft.max_uses ? Number(draft.max_uses) : null, expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null, note: draft.note.trim() || null, active: true };
    const err = await db.upsert('promo_codes', [row], 'code').then(() => null, (e: Error) => e.message);
    setMsg({ ok: !err, text: err ?? `${code} yaradıldı — ${days} gün Plus` });
    if (!err) { setDraft({ code: '', days: '30', max_uses: '', expires_at: '', note: '' }); load(); }
  };
  const toggle = async (p: Promo) => { await db.upsert('promo_codes', [{ ...p, active: !p.active }], 'code').catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const remove = async (p: Promo) => { if (!confirm(`${p.code} silinsin? İstifadə tarixçəsi də silinir; artıq verilmiş Plus günləri qalır.`)) return; await db.delete('promo_codes', { code: p.code }).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const state = (p: Promo) => (!p.active ? ['söndürülüb', 'gray'] : p.expires_at && new Date(p.expires_at) < new Date() ? ['müddəti bitib', 'red'] : p.max_uses != null && p.used >= p.max_uses ? ['limit dolub', 'red'] : ['aktiv', 'green']);

  return (
    <Shell title="Promo kodlar">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="card">
        <h2>Yeni kod</h2>
        <p className="muted" style={{ marginTop: 0 }}>İstifadəçi tətbiqdə Plus səhifəsində "Promo kodum var" ilə daxil edir və dərhal N gün Plus alır. Hər istifadəçi bir kodu bir dəfə işlədə bilər.</p>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <label>Kod<div style={{ display: 'flex', gap: 6 }}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="WELCOME30" style={{ flex: 1, textTransform: 'uppercase' }} /><button className="btn ghost" title="Təsadüfi" onClick={() => setDraft({ ...draft, code: rand() })}>🎲</button></div></label>
          <label>Gün sayı<input type="number" min={1} value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} /></label>
          <label>Maks. istifadə (boş = limitsiz)<input type="number" min={1} value={draft.max_uses} onChange={(e) => setDraft({ ...draft, max_uses: e.target.value })} placeholder="100" /></label>
          <label>Bitmə tarixi (istəyə görə)<input type="date" value={draft.expires_at} onChange={(e) => setDraft({ ...draft, expires_at: e.target.value })} /></label>
          <label>Qeyd<input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Instagram kampaniyası" /></label>
        </div>
        <div className="actions" style={{ justifyContent: 'flex-start' }}><button className="btn" onClick={add}><Plus size={14} /> Yarat</button></div>
      </div>
      <table style={{ marginTop: 16 }}>
        <thead><tr><th>Kod</th><th>Gün</th><th>İstifadə</th><th>Bitmə</th><th>Qeyd</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => {
            const [label, tone] = state(p);
            return (
              <tr key={p.code}>
                <td><code style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1 }}>{p.code}</code></td>
                <td>{p.days}</td>
                <td>{p.used}{p.max_uses != null ? ` / ${p.max_uses}` : ''}</td>
                <td className="muted">{p.expires_at ? new Date(p.expires_at).toLocaleDateString('az-AZ') : '—'}</td>
                <td className="muted">{p.note ?? ''}</td>
                <td><button className={`pill ${tone}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(p)}>{label}</button></td>
                <td style={{ textAlign: 'right' }}><button className="btn ghost" onClick={() => remove(p)}><Trash2 size={14} /></button></td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>Hələ kod yoxdur.</td></tr>}
        </tbody>
      </table>
    </Shell>
  );
}
