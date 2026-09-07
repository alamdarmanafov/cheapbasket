import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Btn, Row, Txt } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/store/auth';

const SLIDES = [
  { emoji: '🧺', title: 'Səbətini yarat', body: 'Almaq istədiyin məhsulları əvvəlcədən səbətə at. Axtar, barkodu skan et və ya şəklini çək.' },
  { emoji: '🏆', title: 'Ən sərfəli marketi tap', body: 'Cheap Basket bütün səbətin hansı marketdə daha ucuz olduğunu hesablayır və neçə manat qənaət etdiyini göstərir.' },
  { emoji: '📍', title: 'Get və al', body: 'Sənə ən yaxın filialı xəritədə görürsən, marşruta bax və rahat alış-veriş et. Qiymət düşəndə xəbər veririk.' },
];

/** First-launch walkthrough (3 slides), then the sign-in screen. */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 430);
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const finish = () => {
    auth.finishOnboarding();
    router.replace(auth.session ? '/' : '/auth');
  };
  const next = () => {
    if (last) return finish();
    ref.current?.scrollTo({ x: (index + 1) * w, animated: true });
    setIndex(index + 1);
  };
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / w));

  return (
    <View style={{ flex: 1, backgroundColor: colors.white, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Row gap={8}>
          <LogoMark size={28} />
          <Txt v="bodyStrong">Cheap Basket</Txt>
        </Row>
        {!last && (
          <Pressable onPress={finish} hitSlop={8} accessibilityRole="button">
            <Txt v="captionStrong" color={colors.gray}>
              Keç
            </Txt>
          </Pressable>
        )}
      </Row>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center' }}>
        {SLIDES.map((s) => (
          <View key={s.title} style={{ width: w, paddingHorizontal: space.xl, alignItems: 'center' }}>
            <View style={styles.hero}>
              <Txt style={{ fontSize: 88, lineHeight: 104 }}>{s.emoji}</Txt>
            </View>
            <Txt v="display" center style={{ marginTop: space.xl }}>
              {s.title}
            </Txt>
            <Txt v="body" color={colors.gray} center style={{ marginTop: space.md, maxWidth: 320 }}>
              {s.body}
            </Txt>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: space.lg }}>
        <Row gap={6} style={{ justifyContent: 'center', marginBottom: space.lg }}>
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </Row>
        <Btn title={last ? 'Başla' : 'Növbəti'} icon={last ? 'arrow-forward' : undefined} onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: 220, height: 220, borderRadius: 110, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: space.xxl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.grayLight },
  dotActive: { width: 20, backgroundColor: colors.primary, borderRadius: radius.pill },
});
