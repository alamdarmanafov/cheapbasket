'use client';

import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { StoreBadges } from '@/components/StoreBadges';
import { LINKS } from '@/components/content';
import { useLang } from '@/components/LangContext';

const COPY = {
  az: { title: 'Dostun səni Cheap Market AI-a dəvət edir', body: 'Tətbiqi yüklə, qeydiyyatdan sonra bu kodu yaz — ikiniz də xal qazanırsınız.', open: 'Tətbiqdə aç', code: 'Dəvət kodun' },
  en: { title: 'A friend invited you to Cheap Market AI', body: 'Get the app and enter this code after signing up — you both earn points.', open: 'Open in the app', code: 'Your invite code' },
  tr: { title: 'Arkadaşın seni Cheap Market AI’a davet ediyor', body: 'Uygulamayı indir, kayıttan sonra bu kodu gir — ikiniz de puan kazanırsınız.', open: 'Uygulamada aç', code: 'Davet kodun' },
  ru: { title: 'Друг приглашает вас в Cheap Market AI', body: 'Установите приложение и введите этот код после регистрации — баллы получите оба.', open: 'Открыть в приложении', code: 'Ваш код приглашения' },
} as const;

/** Where an invite link lands. The app answers the same URL when installed. */
export function ReferralPage() {
  const code = (useSearchParams().get('code') ?? '').toUpperCase();
  const { lang } = useLang();
  const c = COPY[(lang as keyof typeof COPY) in COPY ? (lang as keyof typeof COPY) : 'az'];
  return (
    <main>
      <header className="nav"><div className="container nav-inner"><Logo /></div></header>
      <section className="container" style={{ maxWidth: 520, padding: '40px 20px 64px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 26 }}>{c.title}</h1>
        <p className="muted">{c.body}</p>
        {code && (
          <>
            <p className="muted" style={{ marginBottom: 4 }}>{c.code}</p>
            <div style={{ display: 'inline-block', background: '#111', color: '#fff', fontWeight: 800, fontSize: 28, letterSpacing: 4, padding: '12px 24px', borderRadius: 16 }}>{code}</div>
          </>
        )}
        <a className="download" href={`cheapbasket://referral?code=${encodeURIComponent(code)}`} style={{ display: 'block', marginTop: 24 }}>{c.open}</a>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}><StoreBadges appStore={LINKS.appStore} googlePlay={LINKS.googlePlay} /></div>
      </section>
    </main>
  );
}
