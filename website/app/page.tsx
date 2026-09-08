'use client';

import Link from 'next/link';
import { ArrowRight, Check, ChevronDown, Clock, MapPin, ScanLine, Search, ShoppingBasket } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { StoreBadges } from '@/components/StoreBadges';
import { LangPicker } from '@/components/LangPicker';
import { useLang } from '@/components/LangContext';
import { LINKS, PRICING } from '@/components/content';

const STEP_ICONS = [ShoppingBasket, Search, MapPin];
const BENEFIT_ICONS = [Clock, MapPin, ScanLine, Check];

export default function Page() {
  const { t } = useLang();

  return (
    <main id="top">
      <header className="nav">
        <div className="container nav-inner">
          <Logo />
          <nav aria-label="Main">
            <a href="#how">{t.nav.how}</a>
            <a href="#features">{t.nav.features}</a>
            <a href="#plus">{t.nav.plus}</a>
            <a href="#faq">{t.nav.faq}</a>
          </nav>
          <div className="nav-actions">
            <LangPicker />
            <a className="download" href="#download">
              {t.nav.download}
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">● {t.hero.eyebrow}</span>
            <h1>
              {t.hero.h1a}
              <span>{t.hero.h1b}</span>
              {t.hero.h1c}
            </h1>
            <p>{t.hero.p}</p>
            <StoreBadges appStore={LINKS.appStore} googlePlay={LINKS.googlePlay} />
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="red-orb" />
            <div className="phone phone-back">
              <img src="/screens/03-basket.png" alt="" />
            </div>
            <div className="phone phone-front">
              <img src="/screens/05-markets.png" alt="" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="how" id="how">
        <div className="container">
          <h2>{t.how.h2}</h2>
          <p className="section-sub">{t.how.sub}</p>
          <div className="steps">
            {t.how.steps.map(([title, desc], i) => {
              const Icon = STEP_ICONS[i];
              return (
                <div className="step" key={title}>
                  <span>0{i + 1}</span>
                  <div className="step-icon">
                    <Icon />
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Choice */}
      <section className="choice" id="features">
        <div className="container choice-grid">
          <div>
            <h2>
              {t.choice.h2a}
              <br />
              <span>{t.choice.h2b}</span>
              <br />
              <b>{t.choice.h2c}</b>
            </h2>
            <p>{t.choice.p}</p>
            <a className="red-btn" href="#download">
              {t.choice.cta} <ArrowRight size={17} />
            </a>
          </div>
          <div className="basket-scene" aria-hidden="true">
            <div className="big-phone">
              <img src="/screens/04-ai-result.png" alt="" />
            </div>
            <div className="small-phone">
              <img src="/screens/06-map.png" alt="" />
            </div>
            <div className="grocery">🥬 🥕 🥛 🥖</div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="benefits">
        <div className="container benefit-row">
          {t.benefits.map(([title, sub], i) => {
            const Icon = BENEFIT_ICONS[i];
            return (
              <div key={title}>
                <Icon />
                <div>
                  <b>{title}</b>
                  <small>{sub}</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing" id="plus">
        <div className="container">
          <h2>{t.pricing.h2}</h2>
          <p className="section-sub">{t.pricing.sub}</p>
          <div className="plans">
            <div className="plan">
              <h3>{t.pricing.free}</h3>
              <div className="price">
                {t.pricing.freePrice} <small>{t.pricing.freePer}</small>
              </div>
              {t.pricing.freeItems.map((x) => (
                <p key={x}>
                  <Check /> {x}
                </p>
              ))}
              <a className="plan-btn" href="#download">
                {t.pricing.freeCta}
              </a>
            </div>
            <div className="plan featured">
              <span className="popular">{t.pricing.popular}</span>
              <h3>⭐ {t.pricing.plus}</h3>
              <div className="price">
                {PRICING.plusMonthly} <small>{t.pricing.plusPer}</small>
              </div>
              <div className="price-note">{t.pricing.plusYearly}</div>
              {t.pricing.plusItems.map((x) => (
                <p key={x}>
                  <Check /> {x}
                </p>
              ))}
              <a className="plan-btn" href="#download">
                {t.pricing.plusCta}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq" id="faq">
        <div className="container faq-inner">
          <h2>{t.faq.h2}</h2>
          <div className="faq-list">
            {t.faq.items.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q} <ChevronDown size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section className="download-section" id="download">
        <div className="container download-box">
          <div>
            <h2>{t.download.h2}</h2>
            <p>{t.download.p}</p>
          </div>
          <StoreBadges appStore={LINKS.appStore} googlePlay={LINKS.googlePlay} />
        </div>
      </section>

      <footer>
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p style={{ whiteSpace: 'pre-line' }}>{t.footer.tagline}</p>
          </div>
          <div>
            <b>{t.footer.info}</b>
            <a href="#how">{t.nav.how}</a>
            <a href="#features">{t.nav.features}</a>
            <a href="#faq">{t.nav.faq}</a>
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
            <a href={LINKS.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
        <div className="container copyright">© 2026 Cheap Market AI. {t.footer.rights}</div>
      </footer>
    </main>
  );
}
