import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, space } from '@/theme';
import { Btn, Txt } from './ui';

/** Empty / error / not-found states share one calm layout with a clear next step. */
export function StateView({
  emoji,
  title,
  body,
  cta,
  onCta,
  secondary,
  onSecondary,
  compact = false,
}: {
  emoji: string;
  title: string;
  body?: string;
  cta?: string;
  onCta?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  /** Tighter spacing for a state that shares a sheet with something below it. */
  compact?: boolean;
}) {
  return (
    <View style={[styles.state, compact && { paddingVertical: space.md }]}>
      <View style={styles.emojiWrap}>
        <Txt style={{ fontSize: 40, lineHeight: 48 }}>{emoji}</Txt>
      </View>
      <Txt v="title" center style={{ marginTop: compact ? space.md : space.xl }}>
        {title}
      </Txt>
      {body && (
        <Txt v="body" color={colors.gray} center style={{ marginTop: space.sm, maxWidth: 300 }}>
          {body}
        </Txt>
      )}
      {cta && <Btn title={cta} onPress={onCta} style={{ marginTop: compact ? space.md : space.xl, minWidth: 220 }} full={false} />}
      {secondary && <Btn title={secondary} variant="ghost" size="md" onPress={onSecondary} style={{ marginTop: space.sm }} full={false} />}
    </View>
  );
}

/** Shimmering placeholder block. */
export function Skeleton({ w = '100%', h = 16, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: object }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.fill, opacity: anim }, style]} />;
}

export function ProductRowSkeleton() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}>
      <Skeleton w={56} h={56} r={radius.md} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton w="70%" />
        <Skeleton w="40%" h={12} />
      </View>
      <Skeleton w={56} h={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, paddingVertical: space.xxxl },
  emojiWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
