'use client';

import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LINKS } from '@/components/content';
import { LangPicker } from '@/components/LangPicker';
import { useLang } from '@/components/LangContext';

/** Header and footer shared by every page except the home page, which owns its own scroll-spy nav. */
export function SiteHeader() {
  const { t } = useLang();
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link href="/" aria-label="Cheap Market AI">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <Link href="/#how">{t.nav.how}</Link>
          <Link href="/#features">{t.nav.features}</Link>
          <Link href="/#plus">{t.nav.plus}</Link>
          <Link href="/#faq">{t.nav.faq}</Link>
        </nav>
        <div className="nav-actions">
          <LangPicker />
          <Link className="download" href="/#download">
            {t.nav.download}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useLang();
  return (
    <footer>
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo />
          <p style={{ whiteSpace: 'pre-line' }}>{t.footer.tagline}</p>
        </div>
        <div>
          <b>{t.footer.info}</b>
          <Link href="/#how">{t.nav.how}</Link>
          <Link href="/#features">{t.nav.features}</Link>
          <Link href="/#faq">{t.nav.faq}</Link>
        </div>
        <div>
          <b>{t.footer.legal}</b>
          <Link href="/privacy">{t.footer.privacy}</Link>
          <Link href="/terms">{t.footer.terms}</Link>
          <Link href="/refunds">{t.footer.refunds}</Link>
          <Link href="/cookies">{t.footer.cookies}</Link>
        </div>
        <div>
          <b>{t.footer.company}</b>
          <a href={LINKS.email}>{t.footer.contact}</a>
          <Link href="/delete-account">{t.footer.deleteAccount}</Link>
          <a href={LINKS.instagram} target="_blank" rel="noreferrer">Instagram</a>
          <a href={LINKS.tiktok} target="_blank" rel="noreferrer">TikTok</a>
        </div>
      </div>
      <div className="container copyright">© 2026 Cheap Market AI. {t.footer.rights}</div>
    </footer>
  );
}
