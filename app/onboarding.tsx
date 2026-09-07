import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Row, Txt } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { MiniMap } from '@/components/MiniMap';
import { useAuth } from '@/store/auth';

const MOCK_H = 340;

/** First-launch walkthrough: three slides, each with a live-looking mock of the real screen. */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const w = Math.min(width, 430);
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slides = [
    { key: 'basket', accent: 'Səbətini', rest: 'yarat', body: 'Almaq istədiklərini əvvəlcədən səbətə at: axtar, barkodu skan et və ya şəklini çək.', mock: <BasketMock w={w} /> },
    { key: 'compare', accent: 'Ən sərfəli', rest: 'marketi tap', body: 'Bütün səbətin hansı marketdə daha ucuzdur? Cheap Basket hesablayır, qənaətini göstərir.', mock: <CompareMock w={w} /> },
    { key: 'go', accent: 'Get', rest: 'və al', body: 'Ən yaxın filial xəritədə, marşrut bir kliklə. Qiymət düşəndə səni xəbərdar edirik.', mock: <MapMock w={w} /> },
  ];
  const last = index === slides.length - 1;

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* red hero background */}
      <View style={[styles.heroBg, { height: insets.top + 56 + MOCK_H + 28 }]} />
      <View style={{ flex: 1, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg }}>
          <Row gap={8}>
            <LogoMark size={30} />
            <Txt v="bodyStrong" color={colors.white}>
              Cheap Basket
            </Txt>
          </Row>
          {!last && (
            <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" style={styles.skip}>
              <Txt v="captionStrong" color={colors.white}>
                Keç
              </Txt>
            </Pressable>
          )}
        </Row>

        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{ flex: 1 }}>
          {slides.map((s) => (
            <View key={s.key} style={{ width: w, paddingHorizontal: space.lg }}>
              <View style={{ height: MOCK_H, justifyContent: 'center', alignItems: 'center' }}>{s.mock}</View>
              <Txt v="display" center style={{ marginTop: 56 }}>
                <Txt v="display" color={colors.primary}>
                  {s.accent}
                </Txt>{' '}
                {s.rest}
              </Txt>
              <Txt v="body" color={colors.gray} center style={{ marginTop: space.md, maxWidth: 330, alignSelf: 'center' }}>
                {s.body}
              </Txt>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: space.lg }}>
          <Row gap={6} style={{ justifyContent: 'center', marginBottom: space.lg }}>
            {slides.map((s, i) => (
              <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </Row>
          <Btn title={last ? 'Başla' : 'Növbəti'} icon={last ? 'arrow-forward' : undefined} onPress={next} />
        </View>
      </View>
    </View>
  );
}

/* ---------- mocks (pure UI, no data) ---------- */

const ITEMS = [
  { e: '🥛', n: 'Sütaş Süd 1 L', p: '1.85' },
  { e: '🥚', n: 'Yumurta 10 ədəd', p: '3.20' },
  { e: '🍞', n: 'Çörək', p: '0.60' },
];

function BasketMock({ w }: { w: number }) {
  const cw = Math.min(w - 64, 330);
  return (
    <View style={{ width: cw }}>
      <View style={styles.card}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <Txt v="bodyStrong">Səbətim</Txt>
          <Txt v="caption" color={colors.gray}>
            3 məhsul
          </Txt>
        </Row>
        {ITEMS.map((it, i) => (
          <Row key={it.n} style={[styles.line, i === ITEMS.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.art}>
              <Txt style={{ fontSize: 20, lineHeight: 24 }}>{it.e}</Txt>
            </View>
            <Txt v="captionStrong" style={{ flex: 1, marginLeft: 10 }}>
              {it.n}
            </Txt>
            <Txt v="captionStrong">{it.p} ₼</Txt>
          </Row>
        ))}
      </View>
      <View style={[styles.float, { right: -6, top: -18 }]}>
        <Ionicons name="barcode-outline" size={16} color={colors.white} />
        <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6, fontSize: 11 }}>
          Skan et
        </Txt>
      </View>
      <View style={[styles.float, { left: -8, bottom: -16, backgroundColor: colors.dark }]}>
        <Ionicons name="add" size={16} color={colors.white} />
        <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 4, fontSize: 11 }}>
          Səbətə əlavə et
        </Txt>
      </View>
    </View>
  );
}

const STORES = [
  { n: 'Araz', c: '#2ECC71', t: 5.65, best: true },
  { n: 'Bravo', c: '#16A34A', t: 6.10 },
  { n: 'Bazarstore', c: '#7C3AED', t: 6.95 },
];

function CompareMock({ w }: { w: number }) {
  const cw = Math.min(w - 64, 330);
  const max = Math.max(...STORES.map((s) => s.t));
  return (
    <View style={{ width: cw }}>
      <View style={styles.card}>
        <Txt v="caption" color={colors.gray}>
          Sənin üçün ən sərfəli
        </Txt>
        <Row gap={8} style={{ marginTop: 4 }}>
          <Txt v="title" color={colors.primary}>
            Araz
          </Txt>
          <View style={styles.badge}>
            <Txt v="captionStrong" color={colors.success} style={{ fontSize: 11 }}>
              🏆 2.80 ₼ qənaət
            </Txt>
          </View>
        </Row>
        <View style={{ marginTop: 12, gap: 8 }}>
          {STORES.map((s) => (
            <Row key={s.n} gap={8}>
              <View style={[styles.avatar, { backgroundColor: s.c }]}>
                <Txt style={{ color: '#fff', fontSize: 10, lineHeight: 12, fontFamily: fonts.bold }}>{s.n[0]}</Txt>
              </View>
              <Txt v="caption" style={{ width: 72 }}>
                {s.n}
              </Txt>
              <View style={{ flex: 1, height: 8, backgroundColor: colors.fill, borderRadius: 4 }}>
                <View style={{ width: `${(s.t / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: s.best ? colors.success : colors.grayLight }} />
              </View>
              <Txt v="captionStrong" color={s.best ? colors.success : colors.dark} style={{ width: 52, textAlign: 'right' }}>
                {s.t.toFixed(2)} ₼
              </Txt>
            </Row>
          ))}
        </View>
      </View>
      <View style={[styles.float, { right: -6, top: -18 }]}>
        <Ionicons name="sparkles" size={14} color={colors.white} />
        <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6, fontSize: 11 }}>
          AI müqayisə
        </Txt>
      </View>
    </View>
  );
}

function MapMock({ w }: { w: number }) {
  const cw = Math.min(w - 64, 330);
  const branch = { id: 'demo', storeId: 'araz', name: 'Araz Market', address: 'Nərimanov', lat: 40.404, lng: 49.876, openUntil: '23:00', distanceKm: 1.2, walkMinutes: 5 };
  return (
    <View style={{ width: cw }}>
      <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
        <MiniMap width={cw} height={170} branch={branch} showOthers={false} labels />
        <Row style={{ padding: 12 }} gap={10}>
          <View style={[styles.avatar, { backgroundColor: '#2ECC71', width: 32, height: 32, borderRadius: 16 }]}>
            <Txt style={{ color: '#fff', fontSize: 12, lineHeight: 14, fontFamily: fonts.bold }}>A</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="captionStrong">Araz Market Nərimanov</Txt>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
              1.2 km · 🚶 5 dəq · Açıqdır 23:00-a qədər
            </Txt>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary, width: 32, height: 32, borderRadius: 16 }]}>
            <Ionicons name="navigate" size={16} color={colors.white} />
          </View>
        </Row>
      </View>
      <View style={[styles.float, { left: -8, top: -18, backgroundColor: colors.dark }]}>
        <Ionicons name="notifications" size={14} color={colors.white} />
        <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6, fontSize: 11 }}>
          Süd ucuzlaşdı −20%
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBg: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: colors.primary, borderBottomLeftRadius: 48, borderBottomRightRadius: 48 },
  skip: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, ...shadow.card },
  line: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  art: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
  float: { position: 'absolute', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, ...shadow.card },
  badge: { backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4 },
  avatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.grayLight },
  dotActive: { width: 20, backgroundColor: colors.primary, borderRadius: radius.pill },
});
