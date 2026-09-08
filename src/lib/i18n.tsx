import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dict, type Lang, type Key } from './translations';

export type { Lang, Key };

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const STORAGE_KEY = 'cb_lang';
const FALLBACK: Lang = 'az';

/**
 * The language the provider is currently on, mirrored outside React.
 *
 * Modules that are not components — the assistant, the store-kit wrapper, the
 * confirm helpers, the relative-time formatter — still produce text a user
 * reads, and none of them can call a hook. They read through `tr` instead,
 * which the provider keeps in step with the rendered language below.
 */
let currentLang: Lang = FALLBACK;

/** Translate from outside React. Inside a component prefer `useT()`, which re-renders on change. */
export function tr(key: Key, vars?: Record<string, string | number>): string {
  return lookup(currentLang, key, vars);
}

function lookup(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const table = dict[lang] as Partial<Record<Key, string>>;
  // Azerbaijani is the source language, so it is also the fallback for any
  // key a translation has not caught up with yet.
  let s = table[key] ?? dict.az[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

/**
 * The device language, read without pulling in a native module: React Native
 * already exposes the locale on both platforms, and expo-localization would
 * cost a pod install for the same answer.
 */
function deviceLang(): Lang {
  try {
    const raw =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ??
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : Platform.OS === 'android'
          ? NativeModules.I18nManager?.localeIdentifier
          : typeof navigator !== 'undefined'
            ? navigator.language
            : null;
    const code = String(raw ?? '').slice(0, 2).toLowerCase();
    return LANGS.some((l) => l.id === code) ? (code as Lang) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Looks up a key, filling {placeholders} from `vars`. */
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** False until the stored choice has been read, so nothing flashes the wrong language. */
  ready: boolean;
}

const Ctx = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(FALLBACK);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        setLangState(saved && LANGS.some((l) => l.id === saved) ? (saved as Lang) : deviceLang());
      })
      .catch(() => setLangState(deviceLang()))
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
  }, []);

  // Keep the out-of-React translator on the same language as the tree.
  useEffect(() => {
    currentLang = lang;
  }, [lang]);

  const t = useCallback((key: Key, vars?: Record<string, string | number>) => lookup(lang, key, vars), [lang]);

  const value = useMemo<I18nState>(() => ({ lang, setLang, t, ready }), [lang, setLang, t, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Shorthand for the common case: `const t = useT()`. */
export function useT() {
  return useI18n().t;
}
