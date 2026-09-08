'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Popup, PopupLang, PopupTranslations, db } from '@/lib/supabase';

const EMPTY: Popup = {
  id: '', title: '', body: '', image_url: '', cta_label: '', cta_link: '',
  audience: 'all', max_per_day: 1, max_per_week: 3, sort: 0, active: true, starts_at: null, ends_at: null,
  translations: {},
};

const LANGS: { id: PopupLang; label: string; flag: string }[] = [
  { id: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
];
type Field = 'title' | 'body' | 'cta_label';

/** Azerbaijani lives in the base columns; every other language in `translations`. */
function readField(p: Popup, lang: PopupLang, f: Field): string {
  if (lang === 'az') return (p[f] as string | null) ?? '';
  return p.translations?.[lang]?.[f] ?? '';
}
function writeField(p: Popup, lang: PopupLang, f: Field, v: string): Popup {
  if (lang === 'az') return { ...p, [f]: v };
  const t = p.translations ?? {};
  return { ...p, translations: { ...t, [lang]: { ...t[lang], [f]: v } } };
}
/** Which languages the app can actually show — a language counts once it has both a title and a body. */
function filledLangs(p: Popup): PopupLang[] {
  return LANGS.filter((l) => readField(p, l.id, 'title').trim() && readField(p, l.id, 'body').trim()).map((l) => l.id);
}
/** Drops blank fields and empty languages so the column stays `{"en": {...}}`, never `{"en": {"title": ""}}`. */
function cleanTranslations(t: PopupTranslations | undefined): PopupTranslations {
  const out: PopupTranslations = {};
  for (const l of LANGS) {
    if (l.id === 'az') continue;
    const src = t?.[l.id];
    if (!src) continue;
    const kept = Object.fromEntries(Object.entries(src).filter(([, v]) => (v ?? '').trim() !== ''));
    if (Object.keys(kept).length) out[l.id] = kept;
  }
  return out;
}
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const AUDIENCE: Record<Popup['audience'], string> = { all: 'Hamı', free: 'Yalnız pulsuz', plus: 'Yalnız Plus' };
const capLabel = (n: number) => (n > 0 ? `${n}` : 'limitsiz');

export default function Popups() {
  const [rows, setRows] = useState<Popup[]>([]);
  const [edit, setEdit] = useState<Popup | null>(null);
  const [tab, setTab] = useState<PopupLang>('az');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () =>
    setRows(await db.select<Popup>('popups', { order: 'sort' }).catch((e: Error) => { setMsg({ ok: false, text: e.message }); return []; }));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    const row: Record<string, unknown> = {
      ...edit,
      image_url: edit.image_url?.trim() || null,
      cta_label: edit.cta_label?.trim() || null,
      cta_link: edit.cta_link?.trim() || null,
      max_per_day: Number(edit.max_per_day) || 0,
      max_per_week: Number(edit.max_per_week) || 0,
      translations: cleanTranslations(edit.translations),
    };
    if (!edit.id) delete row.id;
    const err = await db.upsert('popups', [row]).then(() => null, (e: Error) => e.message);
    setBusy(false);
    setMsg({ ok: !err, text: err ?? `"${edit.title}" yadda saxlanıldı — tətbiqdə dərhal görünür` });
    if (!err) { setEdit(null); load(); }
  };

  const remove = async (p: Popup) => {
    if (!confirm(`"${p.title}" silinsin?`)) return;
    const err = await db.delete('popups', { id: p.id }).then(() => null, (e: Error) => e.message);
    setMsg({ ok: !err, text: err ?? 'Silindi' });
    load();
  };
  const toggle = async (p: Popup) => { await db.upsert('popups', [{ ...p, active: !p.active }]).catch((e: Error) => setMsg({ ok: false, text: e.message })); load(); };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    await db.upsert('popups', [{ ...rows[i], sort: j }, { ...rows[j], sort: i }]).catch((e: Error) => setMsg({ ok: false, text: e.message }));
    load();
  };
  const isLive = (p: Popup) => p.active && (!p.starts_at || new Date(p.starts_at) <= new Date()) && (!p.ends_at || new Date(p.ends_at) > new Date());

  return (
    <Shell title="Pop-up bildirişlər">
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="toolbar">
        <span className="muted" style={{ flex: 1 }}>
          Kampaniya və yeni versiya elanları. Tətbiq açılanda sıra üzrə ilk uyğun pop-up göstərilir — göstərmə sayı cihazda saxlanılır.
        </span>
        <button className="btn" onClick={() => { setTab('az'); setEdit({ ...EMPTY, sort: rows.length }); }}><Plus size={14} /> Yeni pop-up</button>
      </div>

      <table>
        <thead><tr><th>Sıra</th><th>Başlıq</th><th>Dillər</th><th>Kimə</th><th>Tezlik</th><th>Tarix</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown size={14} /></button>
              </td>
              <td><b>{p.title}</b><div className="muted" style={{ fontSize: 12 }}>{p.body.slice(0, 70)}{p.body.length > 70 ? '…' : ''}</div></td>
              <td title={filledLangs(p).map((l) => LANGS.find((x) => x.id === l)!.label).join(', ')}>
                {LANGS.map((l) => (
                  <span key={l.id} style={{ opacity: filledLangs(p).includes(l.id) ? 1 : 0.2, marginRight: 3 }}>{l.flag}</span>
                ))}
              </td>
              <td><span className="pill gray">{AUDIENCE[p.audience]}</span></td>
              <td className="muted" style={{ fontSize: 12 }}>gündə {capLabel(p.max_per_day)} · həftədə {capLabel(p.max_per_week)}</td>
              <td className="muted" style={{ fontSize: 12 }}>
                {p.starts_at ? new Date(p.starts_at).toLocaleDateString('az-AZ') : '…'} → {p.ends_at ? new Date(p.ends_at).toLocaleDateString('az-AZ') : '…'}
              </td>
              <td>
                <button className={`pill ${isLive(p) ? 'green' : 'gray'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(p)}>
                  {isLive(p) ? 'canlı' : p.active ? 'tarixə görə gizli' : 'söndürülüb'}
                </button>
              </td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="btn ghost" onClick={() => { setTab('az'); setEdit(p); }}>Düzəlt</button>
                <button className="btn ghost" onClick={() => remove(p)}><Trash2 size={14} /></button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 30 }}>Pop-up yoxdur. Olmayanda tətbiqdə heç nə göstərilmir.</td></tr>}
        </tbody>
      </table>

      {edit && (
        <div className="modal-bg" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>{edit.id ? 'Pop-up-ı düzəlt' : 'Yeni pop-up'}</h2>
              <button className="btn ghost" onClick={() => setEdit(null)}><X size={18} /></button>
            </div>

            <div style={{ margin: '14px 0' }}><Preview p={edit} lang={tab} /></div>

            <div className="tabs" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {LANGS.map((l) => {
                const done = filledLangs(edit).includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`btn ${tab === l.id ? '' : 'secondary'}`}
                    onClick={() => setTab(l.id)}
                    title={done ? 'Tərcümə hazırdır' : 'Boşdur — bu dildə Azərbaycan mətni göstəriləcək'}
                  >
                    {l.flag} {l.label}{done ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>

            <div className="form-grid">
              <label className="full">
                Başlıq{tab !== 'az' && ' (tərcümə)'}
                <input value={readField(edit, tab, 'title')} onChange={(e) => setEdit(writeField(edit, tab, 'title', e.target.value))} placeholder={tab === 'az' ? 'Yeni versiya çıxdı 🎉' : edit.title || 'Azərbaycan mətni'} />
              </label>
              <label className="full">
                Mətn{tab !== 'az' && ' (tərcümə)'}
                <textarea value={readField(edit, tab, 'body')} onChange={(e) => setEdit(writeField(edit, tab, 'body', e.target.value))} rows={3} placeholder={tab === 'az' ? 'Filiallar bölməsi əlavə olundu, qiymətlər daha sürətli yenilənir.' : edit.body || 'Azərbaycan mətni'} />
              </label>
              <label className="full">Şəkil URL (istəyə görə, 800×340 tövsiyə olunur) — bütün dillərdə eynidir<input value={edit.image_url ?? ''} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} placeholder="https://…/kampaniya.jpg" /></label>
              <label>
                Düymə mətni{tab !== 'az' && ' (tərcümə)'}
                <input value={readField(edit, tab, 'cta_label')} onChange={(e) => setEdit(writeField(edit, tab, 'cta_label', e.target.value))} placeholder={tab === 'az' ? 'Ətraflı bax' : edit.cta_label || 'Azərbaycan mətni'} />
              </label>
              <label>Düymə linki (bütün dillərdə eynidir)<input value={edit.cta_link ?? ''} onChange={(e) => setEdit({ ...edit, cta_link: e.target.value })} placeholder="/plus və ya https://…" /></label>
              <label>
                Kimə göstərilsin
                <select value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value as Popup['audience'] })}>
                  <option value="all">Hamı</option>
                  <option value="free">Yalnız pulsuz istifadəçilər</option>
                  <option value="plus">Yalnız Plus abunəçiləri</option>
                </select>
              </label>
              <label>Sıra<input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) })} /></label>
              <label>Gündə maksimum (0 = limitsiz)<input type="number" min={0} value={edit.max_per_day} onChange={(e) => setEdit({ ...edit, max_per_day: Number(e.target.value) })} /></label>
              <label>Həftədə maksimum (0 = limitsiz)<input type="number" min={0} value={edit.max_per_week} onChange={(e) => setEdit({ ...edit, max_per_week: Number(e.target.value) })} /></label>
              <label>Başlama<input type="datetime-local" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: fromLocal(e.target.value) })} /></label>
              <label>Bitmə<input type="datetime-local" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: fromLocal(e.target.value) })} /></label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} style={{ width: 'auto' }} /> Aktiv
              </label>
            </div>

            <p className="note">
              Tətbiq istifadəçinin dilində olan mətni göstərir; həmin dil boşdursa Azərbaycan mətni göstərilir — yəni yalnız Azərbaycan dilini doldurmaq da kifayətdir.
              Göstərmə sayı istifadəçinin cihazında saxlanılır — server tərəfdə hər açılış üçün yazı aparılmır. Tətbiq silinib yenidən qurulsa sayğac sıfırlanır.
            </p>

            <div className="actions">
              <button className="btn secondary" onClick={() => setEdit(null)}>Ləğv et</button>
              <button
                className="btn"
                disabled={!edit.title.trim() || !edit.body.trim() || busy}
                title={!edit.title.trim() || !edit.body.trim() ? 'Azərbaycan başlığı və mətni mütləqdir — o, bütün dillər üçün ehtiyat mətndir' : ''}
                onClick={save}
              >
                {busy ? 'Saxlanılır…' : 'Saxla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Roughly what the app draws for one language, including the Azerbaijani fallback. */
function Preview({ p, lang }: { p: Popup; lang: PopupLang }) {
  const title = readField(p, lang, 'title') || p.title;
  const body = readField(p, lang, 'body') || p.body;
  const cta = readField(p, lang, 'cta_label') || p.cta_label || '';
  return (
    <div style={{ background: '#F3F4F6', borderRadius: 16, padding: 20, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 300, background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 8px 30px #0002' }}>
        {p.image_url && <img src={p.image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />}
        <div style={{ padding: 18, textAlign: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{title || 'Başlıq'}</div>
          <div style={{ color: '#6B7280', fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>{body || 'Mətn burada görünəcək.'}</div>
          <div style={{ marginTop: 16, background: cta ? '#E53935' : '#F3F4F6', color: cta ? '#fff' : '#6B7280', borderRadius: 12, padding: '11px 0', fontWeight: 700, fontSize: 14 }}>
            {cta || 'Bağla'}
          </div>
        </div>
      </div>
    </div>
  );
}
