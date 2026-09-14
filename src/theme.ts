import { Platform, TextStyle } from 'react-native';

/**
 * Brand palette — red is an accent, never the whole UI.
 *
 * Two palettes, one set of names. `white` is the card surface and `dark` the
 * text on it, and they trade places in the dark theme, so a dark chip with
 * white text inverts on its own. What must not invert has its own name:
 * `onAccent` is the text on a red, green or gold background, `inverse` the
 * card that stays near-black in both themes.
 */
export interface Palette {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  dark: string;
  bg: string;
  white: string;
  success: string;
  successSoft: string;
  gray: string;
  grayLight: string;
  line: string;
  fill: string;
  warning: string;
  warningSoft: string;
  gold: string;
  onAccent: string;
  inverse: string;
}

export const light: Palette = {
  primary: '#E53935',
  primaryDark: '#C62828',
  primarySoft: '#FDECEC', // primary at ~8% on white
  dark: '#171717',
  bg: '#F7F7F7',
  white: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#E8F7EE',
  gray: '#6B7280',
  grayLight: '#9CA3AF',
  line: '#ECECEE',
  fill: '#F1F1F3',
  warning: '#D97706',
  warningSoft: '#FEF3E2',
  gold: '#F59E0B',
  onAccent: '#FFFFFF',
  inverse: '#171717',
};

export const dark: Palette = {
  primary: '#EF4B47',
  primaryDark: '#E53935',
  primarySoft: '#3A1D1D',
  dark: '#F4F4F5',
  bg: '#0E0E10',
  white: '#1B1B1E',
  success: '#22C55E',
  successSoft: '#10301C',
  gray: '#A1A1AA',
  grayLight: '#6F6F78',
  line: '#2A2A2F',
  fill: '#26262B',
  warning: '#F5A524',
  warningSoft: '#3A2A10',
  gold: '#F5B31C',
  onAccent: '#FFFFFF',
  inverse: '#2A2A2F',
};

/** The light palette, for code that runs outside a component. Components read `useColors()`. */
export const colors: Palette = light;

/** 8-pt grid */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Inter, loaded in the root layout. Weight is selected by family name on native. */
export const fonts = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/** Four sizes, two weights. Numbers use tabular figures. */
export const type = {
  display: { fontSize: 32, lineHeight: 36, fontFamily: fonts.extrabold, fontWeight: '800' as const, letterSpacing: -1.2 },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.bold, fontWeight: '700' as const, letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular, fontWeight: '400' as const },
  captionStrong: { fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold, fontWeight: '600' as const },
} as const;

export const numeric: TextStyle = {
  fontVariant: ['tabular-nums'],
};

export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#171717',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 2 },
    default: { boxShadow: '0 6px 16px rgba(23,23,23,0.06)' },
  }) as object,
  fab: Platform.select({
    ios: {
      shadowColor: '#E53935',
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
    default: { boxShadow: '0 8px 20px rgba(229,57,53,0.35)' },
  }) as object,
};

export const hit = { top: 8, bottom: 8, left: 8, right: 8 };
