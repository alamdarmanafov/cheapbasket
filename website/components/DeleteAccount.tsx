'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/Chrome';
import { Lang } from '@/components/content';
import { DELETE_COPY } from '@/components/legal-delete';

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

/**
 * Public account deletion, the URL Google Play asks for and the web counterpart
 * of Profile → Hesabı sil in the app. It talks to Supabase's REST auth endpoints
 * directly rather than pulling in supabase-js: this is a static export, and one
 * sign-in plus one delete is not worth shipping a client library for.
 */
export function DeleteAccount() {
  const [lang, setLang] = useState<Lang>('az');
  const t = DELETE_COPY[lang];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const configured = !!SUPABASE_URL && !!SUPABASE_KEY && !!API_URL;

  // Google sends the user back with the session in the URL fragment.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const t0 = p.get('access_token');
    const err = p.get('error_description') ?? p.get('error');
    history.replaceState(null, '', window.location.pathname);
    if (err) return setError(decodeURIComponent(err.replace(/\+/g, ' ')));
    if (t0) void adopt(t0);
  }, []);

  /** Confirms a token really belongs to an account and shows whose it is. */
  async function adopt(accessToken: string) {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${accessToken}` },
      });
      const u = (await r.json()) as { email?: string; msg?: string };
      if (!r.ok) throw new Error(u.msg ?? t.errSession);
      setToken(accessToken);
      setAccount(u.email ?? '—');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errSession);
    }
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const d = (await r.json()) as { access_token?: string; error_description?: string; msg?: string };
      if (!r.ok || !d.access_token) throw new Error(d.error_description ?? d.msg ?? t.errCredentials);
      await adopt(d.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errCredentials);
    } finally {
      setBusy(false);
    }
  }

  function signInWithGoogle() {
    const back = `${window.location.origin}/delete-account`;
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
  }

  async function remove() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/account/delete`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? t.errDelete);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errDelete);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="top">
      <SiteHeader lang={lang} setLang={setLang} />

      <article className="legal">
        <div className="container legal-inner narrow">
          <h1>{t.title}</h1>
          <p className="legal-intro">{t.intro}</p>

          <div className="warn">
            <AlertTriangle size={18} />
            <div>
              <b>{t.warnTitle}</b>
              <ul>
                {t.warnItems.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          </div>

          {done ? (
            <div className="ok-box">
              <b>{t.doneTitle}</b>
              <p>{t.doneBody}</p>
            </div>
          ) : !configured ? (
            <div className="warn">
              <AlertTriangle size={18} />
              <div>
                <b>{t.notConfigured}</b>
                <p style={{ margin: '6px 0 0' }}>{t.notConfiguredBody}</p>
              </div>
            </div>
          ) : !token ? (
            <>
              <h2>{t.step1}</h2>
              <form className="del-form" onSubmit={signIn}>
                <label>
                  {t.email}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                <label>
                  {t.password}
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                <button className="red-btn" type="submit" disabled={busy}>
                  {busy ? t.working : t.signIn}
                </button>
              </form>
              <p className="or">{t.or}</p>
              <button className="plan-btn" type="button" onClick={signInWithGoogle} disabled={busy}>
                {t.google}
              </button>
              <p className="legal-updated" style={{ marginTop: 18 }}>{t.appleNote}</p>
            </>
          ) : (
            <>
              <h2>{t.step2}</h2>
              <p>
                {t.signedInAs} <b>{account}</b>
              </p>
              <p>{t.typeToConfirm}</p>
              <div className="del-form">
                <input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} placeholder={t.confirmWord} aria-label={t.confirmWord} />
                <button className="red-btn danger" type="button" onClick={remove} disabled={busy || confirm !== t.confirmWord}>
                  <Trash2 size={16} /> {busy ? t.working : t.deleteBtn}
                </button>
              </div>
            </>
          )}

          {error && <p className="err-box">{error}</p>}

          <h2>{t.inAppTitle}</h2>
          <p>{t.inAppBody}</p>
          <p>{t.helpBody}</p>
        </div>
      </article>

      <SiteFooter lang={lang} />
    </main>
  );
}
