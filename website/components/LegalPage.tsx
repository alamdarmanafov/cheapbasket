'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/Chrome';
import { type Lang } from '@/components/content';
import { LEGAL, Slug } from '@/components/legal';

/** Shared chrome for the four legal pages: same header, language toggle and footer as the home page. */
export function LegalPage({ slug }: { slug: Slug }) {
  const [lang, setLang] = useState<Lang>('az');
  const doc = LEGAL[lang][slug];

  return (
    <main id="top">
      <SiteHeader lang={lang} setLang={setLang} />

      <article className="legal">
        <div className="container legal-inner">
          <h1>{doc.title}</h1>
          <p className="legal-updated">{doc.updatedLabel}</p>
          <p className="legal-intro">{doc.intro}</p>

          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p?.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {s.ul && (
                <ul>
                  {s.ul.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <nav className="legal-more" aria-label="Legal">
            {(['privacy', 'terms', 'refunds', 'cookies'] as Slug[])
              .filter((s) => s !== slug)
              .map((s) => (
                <Link key={s} href={`/${s}`}>
                  {LEGAL[lang][s].title}
                </Link>
              ))}
          </nav>
        </div>
      </article>

      <SiteFooter lang={lang} />
    </main>
  );
}
