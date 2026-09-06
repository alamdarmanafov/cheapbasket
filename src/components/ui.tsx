import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, numeric, radius, shadow, space, type } from '@/theme';

/* ---------- Typography ---------- */

type TxtVariant = keyof typeof type;
interface TxtProps extends TextProps {
  v?: TxtVariant;
  color?: string;
  num?: boolean;
  center?: boolean;
}
export function Txt({ v = 'body', color = colors.dark, num, center, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[type[v], { color }, num && numeric, center && { textAlign: 'center' }, style]}
      maxFontSizeMultiplier={1.3}
    />
  );
}

/** Price with a smaller currency sign — strong price hierarchy. */
export function Price({
  value,
  size = 'md',
  color = colors.dark,
  style,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const sizes = { sm: 15, md: 18, lg: 28, xl: 40 };
  const fs = sizes[size];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline' }, style]}>
      <Text
        style={[
          numeric,
          { fontSize: fs, lineHeight: fs * 1.15, fontFamily: fs >= 28 ? fonts.extrabold : fonts.bold, fontWeight: '700', color, letterSpacing: fs > 20 ? -1 : -0.2 },
        ]}
        maxFontSizeMultiplier={1.2}
      >
        {value.toFixed(2)}
      </Text>
      <Text style={{ fontSize: fs * 0.62, fontFamily: fonts.semibold, fontWeight: '600', color, marginLeft: 3 }} maxFontSizeMultiplier={1.2}>
        ₼
      </Text>
    </View>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: inset }} />;
}

/* ---------- Buttons ---------- */

interface BtnProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'dark';
  icon?: keyof typeof Ionicons.glyphMap;
  size?: 'md' | 'lg';
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}
export function Btn({ title, variant = 'primary', icon, size = 'lg', loading, full = true, style, disabled, ...rest }: BtnProps) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'dark' ? colors.dark : variant === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = variant === 'primary' || variant === 'dark' ? colors.white : colors.primary;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, height: size === 'lg' ? 56 : 44, paddingHorizontal: size === 'lg' ? 24 : 16 },
        full && { alignSelf: 'stretch' },
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[type.bodyStrong, { color: fg, fontSize: size === 'lg' ? 17 : 15 }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  bg = colors.fill,
  color = colors.dark,
  size = 40,
  label,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  bg?: string;
  color?: string;
  size?: number;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={name} size={size * 0.5} color={color} />
    </Pressable>
  );
}

/* ---------- Chips & pills ---------- */

export function Pill({
  text,
  tone = 'neutral',
  icon,
}: {
  text: string;
  tone?: 'neutral' | 'success' | 'primary' | 'warning';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const map = {
    neutral: { bg: colors.fill, fg: colors.gray },
    success: { bg: colors.successSoft, fg: colors.success },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={map.fg} style={{ marginRight: 4 }} />}
      <Text style={[type.captionStrong, { color: map.fg }]}>{text}</Text>
    </View>
  );
}

export function Chip({ text, onPress, active }: { text: string; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: colors.dark, borderColor: colors.dark },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[type.captionStrong, { color: active ? colors.white : colors.dark }]}>{text}</Text>
    </Pressable>
  );
}

/* ---------- Layout helpers ---------- */

export function Row({ style, children, gap = 0, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
      <Txt v="title">{title}</Txt>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt v="captionStrong" color={colors.primary}>
            {action}
          </Txt>
        </Pressable>
      )}
    </Row>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.lg,
    ...shadow.card,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    height: 26,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    justifyContent: 'center',
  },
});
