import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Card, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FREE_FEATURES, PLUS_FEATURES, PLUS_PRICING } from '@/data/plans';
import { useBasket } from '@/store/basket';

/** Paywall: Free vs Plus, one clear choice, one CTA. Purchase is simulated in the prototype. */
export default function Plus() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPlus, setPlan } = useBasket();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader closeIcon />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 160 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.star}>
            <Txt style={{ fontSize: 30, lineHeight: 36 }}>⭐</Txt>
          </View>
          <Txt v="display" center style={{ marginTop: space.md }}>
            Cheap Basket{'\n'}
            <Txt v="display" color={colors.primary}>
              Plus
            </Txt>
          </Txt>
          <Txt v="body" color={colors.gray} center style={{ marginTop: space.sm, maxWidth: 300 }}>
            Qiymət tarixçəsi, düşüş bildirişləri və AI tövsiyələri ilə hər ay daha çox qənaət et.
          </Txt>
        </View>

        {isPlus && (
          <View style={{ alignItems: 'center', marginTop: space.md }}>
            <Pill tone="success" icon="checkmark-circle" text="Plus aktivdir" />
          </View>
        )}

        {/* Plans */}
        <Row gap={10} style={{ marginTop: space.xl, alignItems: 'stretch' }}>
          <Card style={{ flex: 1, padding: 14 }}>
            <Txt v="captionStrong" color={colors.gray}>
              FREE
            </Txt>
            <Txt v="title" style={{ marginTop: 2 }}>
              0 ₼
            </Txt>
            <View style={{ marginTop: space.md, gap: 8 }}>
              {FREE_FEATURES.map((f) => (
                <Txt key={f.label} v="caption" style={{ fontSize: 12 }}>
                  {f.emoji} {f.label}
                </Txt>
              ))}
            </View>
          </Card>
          <Card style={[{ flex: 1.15, padding: 14, borderWidth: 2, borderColor: colors.primary }]}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="captionStrong" color={colors.primary}>
                ⭐ PLUS
              </Txt>
              <Pill tone="primary" text="Tövsiyə" />
            </Row>
            <Txt v="title" style={{ marginTop: 2 }}>
              {period === 'monthly' ? '1.99 $' : '9.99 $'}
              <Txt v="caption" color={colors.gray}>
                {' '}
                / {period === 'monthly' ? 'ay' : 'il'}
              </Txt>
            </Txt>
            <View style={{ marginTop: space.md, gap: 8 }}>
              {PLUS_FEATURES.map((f) => (
                <Txt key={f.label} v="captionStrong" style={{ fontSize: 12 }}>
                  {f.emoji} {f.label}
                </Txt>
              ))}
            </View>
          </Card>
        </Row>

        {/* Period toggle */}
        <View style={styles.periods}>
          {(['yearly', 'monthly'] as const).map((p) => {
            const active = period === p;
            return (
              <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.period, active && styles.periodActive]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Row gap={6}>
                      <Txt v="bodyStrong">{p === 'yearly' ? 'İllik' : 'Aylıq'}</Txt>
                      {p === 'yearly' && <Pill tone="success" text="−58%" />}
                    </Row>
                    <Txt v="caption" color={colors.gray}>
                      {p === 'yearly' ? `${PLUS_PRICING.yearly.label} · ${PLUS_PRICING.yearly.note}` : PLUS_PRICING.monthly.label}
                    </Txt>
                  </View>
                  <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.grayLight} />
                </Row>
              </Pressable>
            );
          })}
        </View>

        <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.lg, fontSize: 11 }}>
          İstənilən vaxt ləğv edə bilərsən. Ödəniş App Store / Google Play hesabından çıxılır.
        </Txt>
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        {isPlus ? (
          <Btn title="Plus-u dayandır (demo)" variant="secondary" onPress={() => setPlan('free')} />
        ) : (
          <Btn
            title={period === 'yearly' ? 'Plus-a keç · 9.99 $ / il' : 'Plus-a keç · 1.99 $ / ay'}
            icon="star"
            onPress={() => {
              setPlan('plus');
              router.back();
            }}
          />
        )}
        <Txt v="caption" color={colors.gray} center style={{ marginTop: space.sm, fontFamily: fonts.regular }}>
          Prototipdə ödəniş simulyasiya olunur.
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  star: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  periods: { marginTop: space.lg, gap: 10 },
  period: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: colors.line },
  periodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.card,
  },
});
