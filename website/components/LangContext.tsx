'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CONTENT, Lang } from '@/components/content';

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
];

const KEY = 'cm_lang';
const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.id === v);

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof CONTENT)['az'];
}
const LangCtx = createContext<Ctx | null>(null);

/**
 * One language choice for the whole site, remembered across pages.
 *
 * The pages are statically prerendered in Azerbaijani, so the stored choice is
 * applied in an effect rather than during render — reading localStorage while
 * rendering would make the client markup disagree with the prerendered HTML.
 */
export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('az');

  useEffect(() => {
    let next: Lang | null = null;
    try {
      const saved = localStorage.getItem(KEY);
      if (isLang(saved)) next = saved;
    } catch {
      /* private mode, blocked storage — fall through to the browser language */
    }
    if (!next) {
      const code = (navigator.language || '').slice(0, 2).toLowerCase();
      if (isLang(code)) next = code;
    }
    if (next && next !== 'az') setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* nothing to do — the choice still applies for this visit */
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ lang, setLang, t: CONTENT[lang] }), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
