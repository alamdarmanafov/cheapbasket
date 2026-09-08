'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { LANGS, useLang } from '@/components/LangContext';

/** A real menu: the chevron promised a choice, so clicking opens one instead of flipping the language. */
export function LangPicker() {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.id === lang) ?? LANGS[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="lang-wrap" ref={box}>
      <button
        type="button"
        className="lang"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${current.label}`}
      >
        <span aria-hidden>{current.flag}</span>
        {current.id.toUpperCase()}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>

      {open && (
        <ul className="lang-menu" role="listbox" aria-label="Language">
          {LANGS.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                role="option"
                aria-selected={l.id === lang}
                onClick={() => {
                  setLang(l.id);
                  setOpen(false);
                }}
              >
                <span aria-hidden>{l.flag}</span>
                <span className="lang-label">{l.label}</span>
                {l.id === lang && <Check size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
