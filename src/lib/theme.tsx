import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palette, dark, light } from '@/theme';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'cb_theme';

interface ThemeState {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  /** The palette in force: the system's unless the person chose one. */
  colors: Palette;
  isDark: boolean;
}

const Ctx = createContext<ThemeState>({ mode: 'system', setMode: () => undefined, colors: light, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => (v === 'light' || v === 'dark' || v === 'system') && setModeState(v))
      .catch(() => undefined);
  }, []);
  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => undefined);
  };
  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo<ThemeState>(() => ({ mode, setMode, colors: isDark ? dark : light, isDark }), [mode, isDark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  return useContext(Ctx);
}

/** The palette to draw with right now. */
export function useColors(): Palette {
  return useContext(Ctx).colors;
}

/**
 * A StyleSheet that follows the theme.
 *
 * `const useStyles = makeStyles((colors) => ({ … }))`, then
 * `const styles = useStyles()` in the component. Built once per palette and
 * kept, so a re-render costs a lookup, not a rebuild.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<unknown>>(build: (colors: Palette) => T & StyleSheet.NamedStyles<unknown>): () => T {
  const cache = new WeakMap<Palette, T>();
  return function useStyles(): T {
    const c = useColors();
    let s = cache.get(c);
    if (!s) {
      s = StyleSheet.create(build(c));
      cache.set(c, s);
    }
    return s;
  };
}
