import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PLUS_PRICING } from '@/data/plans';
import { PLUS_SKUS } from '@/lib/plusStore';
import { useBasket } from '@/store/basket';
import { useI18n, type Key } from '@/lib/i18n';
import { useAuth } from '@/store/auth';
import { usePlusStore } from '@/lib/iap';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/track';

/** Feature × plan matrix: [label, free, plus] — text means a limited free tier. */
const FEATURES: Array<[Key, Key | boolean, Key | boolean]> = [
  ['plus.rowBasket', 'plus.oneBasket', 'plus.unlimited'],
  ['plus.rowCompare', true, true],
  ['plus.rowBest', true, true],
  ['plus.rowBranch', true, true],
  ['plus.rowScan', true, true],
  ['plus.rowDigest', false, 'plus.everyDay'],
  ['plus.rowAlert', false, true],
  ['plus.rowAdvice', false, true],
  ['plus.rowSavings', false, true],
];

export default function Plus() {
  const refresh = useRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPlus } = useBasket();
  const { t, lang } = useI18n();
  const auth = useAuth();
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const expires = auth.profile?.planExpiresAt ? new Date(auth.profile.planExpiresAt) : null;
  const daysLeft = expires ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000)) : null;

  const store = usePlusStore();
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  useEffect(() => {
    track('plus_view');
  }, []);

  const redeem = async () => {
    if (!auth.user) return router.push('/auth');
    if (!supabase || promo.trim().length < 3) return;
    setPromoBusy(true);
    const { data, error } = await supabase.rpc('redeem_promo', { p_code: promo.trim() });
    setPromoBusy(false);
    if (error) return notify(t('plus.codeRejected'), error.message.replace(/^.*?: /, ''));
    const r = data as { days: number; expires_at: string };
    track('promo', { code: promo.trim().toUpperCase(), days: r.days });
    await auth.refreshProfile();
    setPromo('');
    setPromoOpen(false);
    notify(t('plus.active'), t('plus.daysAdded', { days: r.days, date: new Date(r.expires_at).toLocaleDateString(lang) }));
  };
  const priceLabel = (p: 'monthly' | 'yearly') => {
    const fromStore = store.prices[p];
    if (fromStore) return p === 'yearly' ? `${fromStore} / il` : `${fromStore} / ay`;
    return PLUS_PRICING[p].label;
  };

  /**
   * The store connected and finished loading but returned no product for this id.
   * Without this the button stayed tappable and the purchase failed with nothing
   * on screen to say why.
   */
  const storeMissing = store.available && store.ready && !store.prices[period];

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
            Cheap Market AI{' '}
            <Txt v="display" color={colors.primary}>
              Plus
            </Txt>
          </Txt>
          <Txt v="body" color={colors.gray} center style={{ marginTop: space.sm, maxWidth: 320 }}>
            Hər gün endirim xəbəri, qiymət düşüşü bildirişləri və AI tövsiyələri ilə daha çox qənaət et.
          </Txt>
          {isPlus && (
            <View style={{ marginTop: space.md }}>
              <Pill tone="success" icon="checkmark-circle" text={daysLeft == null ? t('profile.plusActive') : t('plus.activeLeft', { days: daysLeft })} />
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
                {t(label)}
              </Txt>
              <Cell v={typeof free === 'string' ? t(free) : free} />
              <Cell v={typeof plus === 'string' ? t(plus) : plus} plus />
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
                        <Txt v="bodyStrong">{t(p === 'yearly' ? 'plus.yearly' : 'plus.monthly')}</Txt>
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
            <Row gap={space.lg} style={{ justifyContent: 'center', marginTop: space.sm }}>
              <Pressable onPress={store.restore} disabled={store.busy} accessibilityRole="button" style={{ padding: 6 }}>
                <Txt v="captionStrong" color={colors.gray}>
                  Alışları bərpa et
                </Txt>
              </Pressable>
              <Pressable onPress={() => setPromoOpen((v) => !v)} accessibilityRole="button" style={{ padding: 6 }}>
                <Txt v="captionStrong" color={colors.primary}>
                  Promo kodum var
                </Txt>
              </Pressable>
            </Row>
            {promoOpen && (
              <Row gap={space.sm} style={{ marginTop: space.sm }}>
                <TextInput
                  value={promo}
                  onChangeText={(t) => setPromo(t.toUpperCase())}
                  placeholder="PROMO KOD"
                  placeholderTextColor={colors.grayLight}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={redeem}
                  style={styles.promoInput}
                />
                <Btn title={t('plus.apply')} size="md" full={false} loading={promoBusy} onPress={redeem} disabled={promo.trim().length < 3} />
              </Row>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        {isPlus ? (
          <Btn title={expires ? `Plus · ${t('plus.untilDate', { date: expires.toLocaleDateString(lang) })}` : t('profile.plusActive')} variant="secondary" onPress={() => router.back()} />
        ) : (
          <>
            {storeMissing && (
              <Txt v="caption" color={colors.warning} center style={{ marginBottom: space.sm }}>
                Bu abunəlik mağazada tapılmadı ({PLUS_SKUS[period]}). App Store Connect-də məhsul ID-si və Paid Applications müqaviləsini yoxla.
              </Txt>
            )}
            <Btn
              title={store.busy ? t('plus.wait') : t('plus.goPlus', { price: priceLabel(period) })}
              icon="star"
              onPress={subscribe}
              disabled={store.busy || storeMissing}
            />
          </>
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
  promoInput: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 1.5, color: colors.dark },
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
