'use client';
import { useEffect, useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

interface Feedback { id: string; user_id: string | null; email: string | null; kind: string; message: string; platform: string | null; status: string; admin_note: string | null; created_at: string }
const KIND: Record<string, string> = { question: 'Sual', complaint: 'Şikayət', suggestion: 'Təklif' };

export default function FeedbackPage() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [filter, setFilter] = useState<'new' | 'done' | ''>('new');
  const [msg, setMsg] = useState<string | null>(null);
  const load = async () => setRows(await db.select<Feedback>('feedback', { order: 'created_at' }).then((r) => r.reverse()).catch((e: Error) => { setMsg(e.message); return []; }));
  useEffect(() => { load(); }, []);
  const mark = async (f: Feedback, status: string) => { await db.upsert('feedback', [{ ...f, status }], 'id').catch((e: Error) => setMsg(e.message)); load(); };
  const note = async (f: Feedback, admin_note: string) => { await db.upsert('feedback', [{ ...f, admin_note }], 'id').catch((e: Error) => setMsg(e.message)); };
  const remove = async (f: Feedback) => { if (!confirm('Silinsin?')) return; await db.delete('feedback', { id: f.id }).catch((e: Error) => setMsg(e.message)); load(); };
  const shown = rows.filter((r) => !filter || r.status === filter);
  return (
    <Shell title="Rəylər və şikayətlər">
      {msg && <div className="alert err">{msg}</div>}
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'new' | 'done' | '')}>
          <option value="new">Yeni ({rows.filter((r) => r.status === 'new').length})</option>
          <option value="done">Baxılıb ({rows.filter((r) => r.status === 'done').length})</option>
          <option value="">Hamısı</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Tarix</th><th>Növ</th><th>Mesaj</th><th>Kimdən</th><th>Qeyd</th><th></th></tr></thead>
        <tbody>
          {shown.map((f) => (
            <tr key={f.id}>
              <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(f.created_at).toLocaleString('az-AZ')}<div>{f.platform}</div></td>
              <td><span className={`pill ${f.kind === 'complaint' ? 'red' : f.kind === 'suggestion' ? 'green' : 'gray'}`}>{KIND[f.kind] ?? f.kind}</span></td>
              <td style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{f.message}</td>
              <td className="muted" style={{ fontSize: 12 }}>{f.email ? <a href={`mailto:${f.email}`}>{f.email}</a> : '—'}{f.user_id && <div title={f.user_id}>qeydiyyatlı</div>}</td>
              <td><input defaultValue={f.admin_note ?? ''} placeholder="qeyd" style={{ width: 160, textAlign: 'left' }} onBlur={(e) => note(f, e.target.value)} /></td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                {f.status === 'new' ? <button className="btn ghost" title="Baxıldı" onClick={() => mark(f, 'done')}><Check size={16} /></button> : <button className="btn ghost" onClick={() => mark(f, 'new')}>Yenidən aç</button>}
                <button className="btn ghost" onClick={() => remove(f)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 30 }}>Mesaj yoxdur.</td></tr>}
        </tbody>
      </table>
    </Shell>
  );
}
