'use client';
import { useEffect, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { SEGMENTS } from '@/lib/segments.shared';
import { db } from '@/lib/supabase';

interface Settings { enabled: boolean; free_days: number[]; hour_baku: number; max_items: number; lookback_free_days: number; use_ai?: boolean; plus_only?: boolean }
interface Info { settings: Settings; last: Array<{ sent_at: string; title: string; body: string }>; drops: Array<{ brand: string; name: string; size: string; store_name: string; old_price: number; new_price: number; drop_percent: number; changed_at: string }>; ai: 'openai' | 'claude' | 'template'; cron: boolean }

export default function Notifications() {
  const [count, setCount] = useState<number | null>(null);
  const [segment, setSegment] = useState('all');
  const [city, setCity] = useState('');
  const [url, setUrl] = useState('');
  const [segCount, setSegCount] = useState<{ devices: number; users: number } | null>(null);
  useEffect(() => {
    setSegCount(null);
    const t = setTimeout(() => fetch(`/api/push?segment=${segment}&city=${encodeURIComponent(city)}`).then((r) => r.json()).then((j) => setSegCount(j.error ? null : j)).catch(() => setSegCount(null)), 300);
    return () => clearTimeout(t);
  }, [segment, city]);
  const [title, setTitle] = useState('Cheap Market AI');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [s, setS] = useState<Settings | null>(null);
  const [preview, setPreview] = useState<Array<{ user_id: string; title: string; body: string }> | null>(null);

  const load = async () => {
    const r = await fetch('/api/digest').then((x) => x.json());
    setInfo(r);
    setS(r.settings);
  };
  useEffect(() => {
    db.count('push_tokens').then(setCount).catch(() => setCount(0));
    load();
  }, []);

  const send = async () => {
    setBusy(true);
    setResult(null);
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, segment, city, url: url.trim() || undefined }) });
    const j = await res.json();
    setBusy(false);
    setResult({ ok: res.ok, text: res.ok ? `${j.sent} cihaza göndərildi${j.errors ? `, ${j.errors} xəta` : ''}` : j.error ?? 'Xəta' });
  };

  const saveSettings = async () => {
    const res = await fetch('/api/digest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'settings', value: s }) });
    setResult({ ok: res.ok, text: res.ok ? 'Ayarlar yadda saxlanıldı' : (await res.json()).error });
  };
  const runDigest = async (dryRun: boolean) => {
    setBusy(true);
    setPreview(null);
    const res = await fetch('/api/digest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'run', force: true, dryRun }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setResult({ ok: false, text: j.error });
    else {
      setPreview(j.preview ?? []);
      setResult({ ok: true, text: dryRun ? `${j.users} istifadəçi üçün mətn hazırlandı (göndərilmədi)` : `${j.users} istifadəçi · ${j.sent} cihaza göndərildi${j.errors ? `, ${j.errors} xəta` : ''}` });
      load();
    }
  };
  const toggleDay = (d: number) => s && setS({ ...s, free_days: s.free_days.includes(d) ? s.free_days.filter((x) => x !== d) : [...s.free_days, d].sort((a, b) => a - b) });

  return (
    <Shell title="Bildirişlər">
      {result && <div className={`alert ${result.ok ? 'ok' : 'err'}`}>{result.text}</div>}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card">
          <h2><Sparkles size={18} style={{ verticalAlign: -3 }} /> AI endirim xəbəri</h2>
          <p className="muted" style={{ marginTop: 0 }}>Ucuzlaşan məhsullardan avtomatik push. <b>Plus</b>: hər gün. Free istifadəçilər yalnız "Yalnız Plus" söndürüləndə (ayın seçilmiş günlərində) alır. Səbətindəki məhsullar birinci gəlir.</p>
          {!info ? <p className="muted">Yüklənir…</p> : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className={`pill ${info.cron ? 'green' : 'red'}`}>{info.cron ? 'Cron aktiv' : 'CRON_SECRET yoxdur'}</span>
                <span className={`pill ${s?.use_ai && info.ai !== 'template' ? 'green' : 'gray'}`}>{!s?.use_ai ? 'Mətn: şablon (pulsuz)' : info.ai === 'openai' ? 'Mətn: ChatGPT' : info.ai === 'claude' ? 'Mətn: Claude' : 'Mətn: şablon (OPENAI_API_KEY yoxdur)'}</span>
              </div>
              {s && (
                <>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} /> Aktiv</label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }} title="Söndürüləndə mətn hazır şablonla yazılır və AI-a pul getmir">
                    <input type="checkbox" checked={!!s.use_ai} disabled={info.ai === 'template'} onChange={(e) => setS({ ...s, use_ai: e.target.checked })} /> Mətni AI yazsın {info.ai === 'template' ? '(OPENAI_API_KEY yoxdur)' : '(hər istifadəçi üçün ≈ 0.0001 $)'}
                  </label>
                  <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }} title="Söndürsən Free istifadəçilər də ayın seçilmiş günlərində alır">
                    <input type="checkbox" checked={s.plus_only !== false} onChange={(e) => setS({ ...s, plus_only: e.target.checked })} /> Yalnız Plus abunəçilərə (Premium funksiya)
                  </label>
                  {s.plus_only === false && (
                    <>
                      <label style={{ marginTop: 10 }}>Free istifadəçilər üçün günlər (ayın günü)</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <button key={d} className={`btn ${s.free_days.includes(d) ? '' : 'secondary'}`} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => toggleDay(d)}>{d}</button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <label>Maks. məhsul sayı<input type="number" min={1} max={10} value={s.max_items} onChange={(e) => setS({ ...s, max_items: Number(e.target.value) })} /></label>
                    <label>Free üçün son N gün<input type="number" min={1} max={31} value={s.lookback_free_days} onChange={(e) => setS({ ...s, lookback_free_days: Number(e.target.value) })} /></label>
                  </div>
                  <p className="note">Göndəriş vaxtı: hər gün 09:00 (Bakı). Vaxtı dəyişmək üçün <code>admin/vercel.json</code> → crons.</p>
                  <div className="actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn secondary" onClick={saveSettings}>Ayarları saxla</button>
                    <button className="btn secondary" disabled={busy} onClick={() => runDigest(true)}>Mətni göstər (göndərmə)</button>
                    <button className="btn" disabled={busy} onClick={() => { if (confirm('Bütün cihazlara indi göndərilsin?')) runDigest(false); }}>İndi göndər</button>
                  </div>
                </>
              )}
              {preview && (
                <div style={{ marginTop: 12 }}>
                  <b>Hazırlanan mətnlər ({preview.length})</b>
                  {preview.length === 0 && <p className="muted">Göndəriləcək endirim yoxdur: son günlərdə qiymət düşüşü qeydə alınmayıb və ya cihaz yoxdur.</p>}
                  {preview.slice(0, 5).map((p, i) => <div key={i} className="card" style={{ marginTop: 8, padding: 12 }}><b>{p.title}</b><br /><span className="muted" style={{ whiteSpace: 'pre-line' }}>{p.body}</span></div>)}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <b>Son qiymət düşüşləri</b>
                {info.drops.length === 0 ? <p className="muted">Hələ yoxdur. Məhsullar səhifəsində qiyməti aşağı salanda burada görünəcək.</p> : (
                  <table style={{ marginTop: 8 }}><tbody>
                    {info.drops.slice(0, 8).map((d, i) => <tr key={i}><td>{d.brand} {d.name} <span className="muted">{d.size}</span></td><td className="muted">{d.store_name}</td><td style={{ textAlign: 'right' }}><s className="muted">{d.old_price}</s> <b>{d.new_price} ₼</b> <span className="pill green">−{d.drop_percent}%</span></td></tr>)}
                  </tbody></table>
                )}
              </div>
              {info.last.length > 0 && (
                <div style={{ marginTop: 14 }}><b>Son göndərişlər</b>{info.last.map((l, i) => <div key={i} className="muted" style={{ fontSize: 12, marginTop: 4 }}>{new Date(l.sent_at).toLocaleString('az-AZ')} · {l.title}</div>)}</div>
              )}
            </>
          )}
        </div>

        <div className="card">
          <h2>Əl ilə göndəriş</h2>
          <p className="muted" style={{ marginTop: 0 }}>Qeydiyyatlı cihaz: <b>{count ?? '…'}</b></p>
          <label>Kimə
            <select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((sg) => <option key={sg.id} value={sg.id}>{sg.label}</option>)}
            </select>
          </label>
          {segment === 'city' && <label style={{ marginTop: 10 }}>Şəhər<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bakı" /></label>}
          <p className="note">Seçilən seqment: <b>{segCount ? `${segCount.users} istifadəçi · ${segCount.devices} cihaz` : '…'}</b></p>
          <label style={{ marginTop: 10 }}>Başlıq<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label style={{ marginTop: 10 }}>Mətn<textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Bu həftə sonu Araz-da süd məhsulları 15% endirimlə 🎉" /></label>
          <label style={{ marginTop: 10 }}>Açılacaq səhifə (istəyə görə)<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/deals, /plus, /product/ID" /></label>
          <div className="actions">
            <button className="btn" disabled={!body.trim() || busy || !segCount?.devices} onClick={() => { if (confirm(`${segCount?.users ?? 0} istifadəçiyə (${segCount?.devices ?? 0} cihaz) göndərilsin?`)) send(); }}><Send size={14} /> {busy ? 'Göndərilir…' : 'Göndər'}</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
