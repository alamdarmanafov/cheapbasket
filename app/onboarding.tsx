import React, { useRef, useState } from 'react';
import { Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Row, Txt } from '@/components/ui';
import { useT, type Key } from '@/lib/i18n';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/store/auth';

const SLIDES = [
  { key: '1', line1: 'onb.1line1', line2: 'onb.1line2', body: 'onb.1body', note: 'onb.1note', img: require('../assets/onboarding/1.jpg'), ratio: 1242 / 1196 },
  { key: '2', line1: 'onb.2line1', line2: 'onb.2line2', body: 'onb.2body', note: 'onb.2note', img: require('../assets/onboarding/2.jpg'), ratio: 1242 / 1196 },
  { key: '3', line1: 'onb.3line1', line2: 'onb.3line2', body: 'onb.3body', note: 'onb.3note', img: require('../assets/onboarding/3.jpg'), ratio: 1242 / 1213 },
] satisfies Array<{ key: string; line1: Key; line2: Key; body: Key; note: Key; img: number; ratio: number }>;

/** First-launch walkthrough (3 slides with illustrations), then the sign-in screen. */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const t = useT();
  const { height } = useWindowDimensions();
  // Measure the real container (inside the web phone frame the window is much wider than the screen).
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next && next !== w) setW(next);
  };
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;
  const imgH = Math.min(480, Math.max(260, height - 430));

  const finish = () => {
    auth.finishOnboarding();
    router.replace(auth.session ? '/' : '/auth');
  };
  const next = () => {
    if (last) return finish();
    ref.current?.scrollTo({ x: (index + 1) * w, animated: true });
    setIndex(index + 1);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => w > 0 && setIndex(Math.round(e.nativeEvent.contentOffset.x / w));

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF4F4', paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Row gap={10}>
          <LogoMark size={40} />
          <View>
            <Txt style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 18 }}>Cheap Market</Txt>
            <Txt style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 18, color: colors.primary }}>AI</Txt>
          </View>
        </Row>
        {!last ? (
          <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
            <Txt v="body" color={colors.gray}>
              {t('onboarding.skip')}
            </Txt>
          </Pressable>
        ) : (
          <View />
        )}
      </Row>

      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{ flex: 1 }} onLayout={onLayout}>
        {w > 0 && SLIDES.map((s) => (
          <View key={s.key} style={{ width: w, paddingHorizontal: space.xl, alignItems: 'center' }}>
            <Txt style={styles.h1} center>
              {t(s.line1)}
            </Txt>
            <Txt style={[styles.h1, { color: colors.primary, marginTop: 0 }]} center>
              {t(s.line2)}
            </Txt>
            <Txt v="body" color={colors.gray} center style={{ marginTop: space.md, maxWidth: 300 }}>
              {t(s.body)}
            </Txt>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {/* The illustrations are cropped straight from the design, so they
                  carry their own background — rounded so a photographic one
                  reads as a card rather than a rectangle stuck on the page. */}
              <Image
                source={s.img}
                style={{ width: Math.min(w - 72, imgH * s.ratio), height: Math.min(imgH, (w - 72) / s.ratio), borderRadius: 22 }}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </View>
            <Txt style={styles.note}>{t(s.note)}</Txt>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg }}>
        <Row gap={6} style={{ justifyContent: 'center', marginBottom: space.lg }}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </Row>
        <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
          {!last && <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginRight: 8 }} />}
          <Txt v="bodyStrong" color={colors.white} style={{ fontSize: 17 }}>
            {last ? t('onb.start') : t('onb.next')}
          </Txt>
          {last && <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: colors.dark, marginTop: 12 },
  note: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.primary, textAlign: 'center', fontStyle: 'italic', transform: [{ rotate: '-4deg' }], marginBottom: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5C9C9' },
  dotActive: { width: 22, backgroundColor: colors.primary, borderRadius: radius.pill },
  btn: { height: 56, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
