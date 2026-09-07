'use client';
import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { db } from '@/lib/supabase';

export default function Notifications() {
  const [count, setCount] = useState<number | null>(null);
  const [title, setTitle] = useState('Cheap Basket');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.count('push_tokens').then(setCount).catch(() => setCount(0));
  }, []);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body }) });
    const j = await res.json();
    setBusy(false);
    setResult({ ok: res.ok, text: res.ok ? `${j.sent} cihaza göndərildi${j.errors ? `, ${j.errors} xəta` : ''}` : j.error ?? 'Xəta' });
  };

  return (
    <Shell title="Bildirişlər">
      <div className="card" style={{ maxWidth: 560 }}>
        <p className="muted" style={{ marginTop: 0 }}>Qeydiyyatlı cihaz: <b>{count ?? '…'}</b></p>
        <label>Başlıq<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label style={{ marginTop: 10 }}>Mətn<textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Sütaş Süd 1L Araz-da 1.99 ₼ oldu 🎉" /></label>
        {result && <div className={`alert ${result.ok ? 'ok' : 'err'}`} style={{ marginTop: 12 }}>{result.text}</div>}
        <div className="actions">
          <button className="btn" disabled={!body.trim() || busy || !count} onClick={send}><Send size={14} /> {busy ? 'Göndərilir…' : 'Hamısına göndər'}</button>
        </div>
        <p className="note">Expo Push Service ilə göndərilir. Avtomatik "qiymət düşdü" bildirişləri növbəti addımdır (Supabase Edge Function + cron).</p>
      </div>
    </Shell>
  );
}
