import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PLUS_PRICING } from '@/data/plans';
import { useBasket } from '@/store/basket';
import { useAuth } from '@/store/auth';
import { usePlusStore } from '@/lib/iap';

/** Feature × plan matrix: [label, free, plus] — text means a limited free tier. */
const FEATURES: Array<[string, string | boolean, string | boolean]> = [
  ['Səbət', '1 səbət', 'Limitsiz'],
  ['Qiymət müqayisəsi', true, true],
  ['Ən sərfəli market', true, true],
  ['Yaxın filial və xəritə', true, true],
  ['Barkod skanı', true, true],
  ['Şəkillə məhsul tanıma (AI)', 'Gündə 1', 'Limitsiz'],
  ['AI endirim xəbəri', false, 'Hər gün'],
  ['Qiymət tarixçəsi', false, true],
  ['Qiymət düşüşü bildirişi', false, true],
  ['AI tövsiyələri', false, true],
  ['Qənaət statistikası', false, true],
];

export default function Plus() {
  const refresh = useRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPlus } = useBasket();
  const auth = useAuth();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const expires = auth.profile?.planExpiresAt ? new Date(auth.profile.planExpiresAt) : null;
  const daysLeft = expires ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000)) : null;

  const store = usePlusStore();
  const priceLabel = (p: 'monthly' | 'yearly') => {
    const fromStore = store.prices[p];
    if (fromStore) return p === 'yearly' ? `${fromStore} / il` : `${fromStore} / ay`;
    return PLUS_PRICING[p].label;
  };

  const subscribe = () => {
    if (!auth.user) {
      router.push('/auth');
      return;
    }
    store.buy(period);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader closeIcon />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 170 }} refreshControl={refresh.control}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.star}>
            <Txt style={{ fontSize: 30, lineHeight: 36 }}>⭐</Txt>
          </View>
          <Txt v="display" center style={{ marginTop: space.md }}>
            Cheap Basket{' '}
            <Txt v="display" color={colors.primary}>
              Plus
            </Txt>
          </Txt>
          <Txt v="body" color={colors.gray} center style={{ marginTop: space.sm, maxWidth: 320 }}>
            Hər gün endirim xəbəri, qiymət tarixçəsi, düşüş bildirişləri və AI tövsiyələri ilə daha çox qənaət et.
          </Txt>
          {isPlus && (
            <View style={{ marginTop: space.md }}>
              <Pill tone="success" icon="checkmark-circle" text={daysLeft == null ? 'Plus aktivdir' : `Plus aktivdir · ${daysLeft} gün qalıb`} />
            </View>
          )}
        </View>

        {/* Comparison table */}
        <View style={styles.table}>
          <Row style={[styles.tr, styles.th]}>
            <Txt v="captionStrong" color={colors.gray} style={{ flex: 1 }}>
              Funksiya
            </Txt>
            <Txt v="captionStrong" color={colors.gray} style={styles.col} center>
              FREE
            </Txt>
            <Txt v="captionStrong" color={colors.primary} style={styles.col} center>
              ⭐ PLUS
            </Txt>
          </Row>
          {FEATURES.map(([label, free, plus], i) => (
            <Row key={label} style={[styles.tr, i % 2 === 1 && { backgroundColor: colors.bg }]}>
              <Txt v="body" style={{ flex: 1, fontSize: 14 }}>
                {label}
              </Txt>
              <Cell v={free} />
              <Cell v={plus} plus />
            </Row>
          ))}
        </View>

        {/* Period */}
        {!isPlus && (
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
                        {p === 'yearly' ? `${priceLabel('yearly')} · ${PLUS_PRICING.yearly.note}` : priceLabel('monthly')}
                      </Txt>
                    </View>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.grayLight} />
                  </Row>
                </Pressable>
              );
            })}
            {store.error && (
              <Txt v="caption" color={colors.primary} center style={{ marginTop: space.sm }}>
                {store.error}
              </Txt>
            )}
            <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.md, fontSize: 11 }}>
              İstənilən vaxt ləğv edə bilərsən. Ödəniş App Store / Google Play hesabından çıxılır və avtomatik yenilənir.
            </Txt>
            <Pressable onPress={store.restore} disabled={store.busy} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.sm, padding: 6 }}>
              <Txt v="captionStrong" color={colors.gray}>
                Alışları bərpa et
              </Txt>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        {isPlus ? (
          <Btn title={expires ? `Plus · ${expires.toLocaleDateString('az-AZ')} tarixinə qədər` : 'Plus aktivdir'} variant="secondary" onPress={() => router.back()} />
        ) : (
          <Btn title={store.busy ? 'Gözlə…' : `Plus-a keç · ${priceLabel(period)}`} icon="star" onPress={subscribe} disabled={store.busy} />
        )}
      </View>
    </View>
  );
}

function Cell({ v, plus }: { v: string | boolean; plus?: boolean }) {
  return (
    <View style={[styles.col, { alignItems: 'center' }]}>
      {typeof v === 'string' ? (
        <Txt v="captionStrong" center color={plus ? colors.primary : colors.dark} style={{ fontSize: 11 }}>
          {v}
        </Txt>
      ) : v ? (
        <Ionicons name="checkmark-circle" size={20} color={plus ? colors.primary : colors.success} />
      ) : (
        <Ionicons name="remove" size={18} color={colors.grayLight} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  star: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' },
  table: { marginTop: space.xl, backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  tr: { paddingVertical: 12, paddingHorizontal: space.md },
  th: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  col: { width: 82 },
  periods: { marginTop: space.lg, gap: 10 },
  period: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, borderWidth: 1.5, borderColor: colors.line },
  periodActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, paddingHorizontal: space.lg, paddingTop: space.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow.card },
});
