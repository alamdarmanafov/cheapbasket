import { Platform, TextStyle } from 'react-native';

/** Brand palette — red is an accent, never the whole UI. */
export const colors = {
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
} as const;

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
