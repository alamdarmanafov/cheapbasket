'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/Chrome';
import { Lang } from '@/components/content';

const COPY = {
  az: {
    okTitle: 'Giriş tamamlandı',
    okBody: 'Cheap Market AI tətbiqinə qayıda bilərsən — hesabına daxil olmusan. Bu səhifəni bağlamaq olar.',
    openApp: 'Tətbiqi aç',
    failTitle: 'Giriş tamamlanmadı',
    failBody: 'Yenidən cəhd et. Problem davam edərsə, tətbiqdən başqa üsulla daxil ol.',
    home: 'Ana səhifəyə qayıt',
  },
  en: {
    okTitle: 'You are signed in',
    okBody: 'You can go back to the Cheap Market AI app — your account is ready. This page can be closed.',
    openApp: 'Open the app',
    failTitle: 'Sign-in did not complete',
    failBody: 'Please try again. If it keeps failing, sign in from the app another way.',
    home: 'Back to the home page',
  },
} as const;

/**
 * Where Supabase lands a web OAuth redirect. Without this page the provider
 * returns the user to the Site URL and they meet a 404 mid sign-in; here they
 * get a branded confirmation instead. The tokens arrive in the URL fragment and
 * are read only to tell success from failure — nothing is stored.
 */
export function AuthCallback() {
  const [lang, setLang] = useState<Lang>('az');
  const [ok, setOk] = useState<boolean | null>(null);
  const t = COPY[lang];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const failed = hash.get('error') ?? query.get('error');
    const signedIn = hash.get('access_token') ?? query.get('code');
    history.replaceState(null, '', window.location.pathname);
    setOk(!failed && !!signedIn);
  }, []);

  return (
    <main id="top">
      <SiteHeader lang={lang} setLang={setLang} />
      <article className="legal">
        <div className="container legal-inner narrow" style={{ textAlign: 'center', paddingTop: 20 }}>
          {ok === null ? null : ok ? (
            <>
              <CheckCircle2 size={54} color="#10b981" />
              <h1 style={{ marginTop: 18 }}>{t.okTitle}</h1>
              <p>{t.okBody}</p>
              <a className="red-btn" href="cheapbasket://" style={{ marginTop: 12, display: 'inline-flex' }}>
                {t.openApp}
              </a>
            </>
          ) : (
            <>
              <XCircle size={54} color="#e53935" />
              <h1 style={{ marginTop: 18 }}>{t.failTitle}</h1>
              <p>{t.failBody}</p>
              <a className="plan-btn" href="/" style={{ marginTop: 12, display: 'inline-flex' }}>
                {t.home}
              </a>
            </>
          )}
        </div>
      </article>
      <SiteFooter lang={lang} />
    </main>
  );
}
