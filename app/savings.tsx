import React, { useCallback, useEffect, useRef, useState } from 'react';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { LogoMark } from '@/components/Logo';
import { track } from '@/lib/track';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Card, Divider, Price, Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useT } from '@/lib/i18n';
import { PlusLock } from '@/components/PlusLock';
import { useBasket } from '@/store/basket';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { getStore } from '@/data/products';
import { monthlyReport } from '@/lib/report';
import { useI18n } from '@/lib/i18n';

/**
 * Savings — computed from the real basket: best store vs the most expensive
 * full-coverage store, plus the per-store breakdown. Purchase history (monthly
 * totals) is added once shopping trips are recorded.
 */
export default function Savings() {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const { lines, count, optimization: o } = useBasket();
  const [trips, setTrips] = useState<Array<{ id: string; store_id: string; total: number; saving: number; items: number; created_at: string }>>([]);
  const loadTrips = useCallback(async () => {
    if (!supabase || !auth.user) return;
    const { data } = await supabase.from('trips').select('id, store_id, total, saving, items, created_at').order('created_at', { ascending: false }).limit(60);
    setTrips((data ?? []) as typeof trips);
  }, [auth.user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadTrips();
  }, [loadTrips]);
  const refresh = useRefresh(loadTrips);
  const { lang } = useI18n();
  const locale = { az: 'az-AZ', en: 'en-US', tr: 'tr-TR', ru: 'ru-RU' }[lang];
  const months = monthlyReport(trips).slice(0, 6);
  const monthName = (m: { year: number; month: number }) => new Date(m.year, m.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const shareReport = async (m: (typeof months)[number]) => {
    track('share', { what: 'monthly_report', month: m.key });
    try {
      await Share.share({ message: t('report.shareText', { month: monthName(m), trips: m.trips, spent: m.spent.toFixed(2), saved: m.saved.toFixed(2), store: m.topStore ? getStore(m.topStore).name : '—' }) });
    } catch {
      /* dismissed */
    }
  };
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const thisMonth = trips.filter((t) => monthKey(new Date(t.created_at)) === monthKey(new Date()));
  const monthSaving = thisMonth.reduce((a, t) => a + Number(t.saving), 0);
  const allSaving = trips.reduce((a, t) => a + Number(t.saving), 0);
  const best = o.best;
  const worst = o.worst;
  const hasBasket = lines.length > 0 && !!best;
  const shotRef = useRef<React.ElementRef<typeof ViewShot>>(null);
  const shareCard = async () => {
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) return;
      track('share', { what: 'savings_card', month_saving: monthSaving });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('sav.shareCard') });
      else await Share.share({ message: `${t('sav.cardTitle')} ${monthSaving.toFixed(2)} ₼ — cheapmarket.app` });
    } catch {
      /* dismissed */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('sav.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} refreshControl={refresh.control}>
        {/* The month's number as a picture: what a story post needs. Captured
            off the same card that is on screen, so it never looks different
            from what the reader saw. */}
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.shareCard}>
          <Row style={{ justifyContent: 'space-between' }}>
            <LogoMark size={28} />
            <Txt v="caption" color="rgba(255,255,255,0.75)">
              cheapmarket.app
            </Txt>
          </Row>
          <Txt v="body" color="rgba(255,255,255,0.85)" style={{ marginTop: space.lg }}>
            {t('sav.cardTitle')}
          </Txt>
          <Txt v="display" color={colors.white}>
            {monthSaving.toFixed(2)} ₼
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.75)">
            {t('sav.cardBody', { n: thisMonth.length })}
          </Txt>
        </ViewShot>
        <Btn title={t('sav.shareCard')} variant="secondary" size="md" icon="share-social" onPress={shareCard} style={{ marginTop: space.sm, marginBottom: space.md }} />

        <View style={styles.hero}>
          <Txt v="body" color="rgba(255,255,255,0.8)">
            {hasBasket ? t('sav.thisBasket') : t('sav.notYet')}
          </Txt>
          <Price value={o.saving} size="xl" color={colors.white} style={{ marginTop: space.sm }} />
          {hasBasket && worst && (
            <Row gap={6} style={{ marginTop: space.sm }}>
              <Ionicons name="trending-down" size={16} color="#A7F3C6" />
              <Txt v="captionStrong" color="#A7F3C6">
                {best.store.name} ({best.total.toFixed(2)} ₼) vs {worst.store.name} ({worst.total.toFixed(2)} ₼)
              </Txt>
            </Row>
          )}
        </View>

        {hasBasket ? (
          <PlusLock feature={t('sav.stats')} minHeight={320}>
            <Row gap={space.md} style={{ marginTop: space.lg }}>
              <Stat value={String(count)} label={t('sav.compared')} />
              <Stat value={String(o.ranked.filter((r) => r.missing.length === 0).length)} label={t('sav.fullBasket')} />
            </Row>
            <Card style={{ marginTop: space.lg, paddingVertical: space.xs }}>
              {o.ranked.map((r, i) => (
                <React.Fragment key={r.store.id}>
                  {i > 0 && <Divider />}
                  <Row style={{ paddingVertical: space.md }} gap={space.md}>
                    <StoreAvatar store={r.store} size={36} />
                    <View style={{ flex: 1 }}>
                      <Txt v="body">{r.store.name}</Txt>
                      <Txt v="caption" color={r.missing.length ? colors.warning : colors.gray}>
                        {r.missing.length ? t('sav.missingN', { n: r.missing.length }) : i === 0 ? t('sav.best') : `+${(r.total - best.total).toFixed(2)} ₼`}
                      </Txt>
                    </View>
                    <Price value={r.total} size="sm" color={i === 0 ? colors.success : colors.dark} />
                  </Row>
                </React.Fragment>
              ))}
            </Card>
          </PlusLock>
        ) : (
          <Card style={{ marginTop: space.lg, alignItems: 'center', padding: space.xl }}>
            <Txt style={{ fontSize: 36, lineHeight: 44 }}>🧺</Txt>
            <Txt v="bodyStrong" style={{ marginTop: space.sm }}>
              {t('sav.emptyTitle')}
            </Txt>
            <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
              {t('sav.emptyBody')}
            </Txt>
          </Card>
        )}

        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          {t('sav.historyTitle')}
        </Txt>
        <PlusLock feature={t('sav.monthly')} minHeight={200}>
          <Row gap={space.md}>
            <Stat value={`${monthSaving.toFixed(2)} ₼`} label={t('sav.thisMonth', { n: thisMonth.length })} />
            <Stat value={`${allSaving.toFixed(2)} ₼`} label={t('sav.allTime', { n: trips.length })} />
          </Row>
          {trips.length === 0 ? (
            <Txt v="caption" color={colors.gray} center style={{ marginTop: space.md }}>
              Xəritədə {t('sav.route')} basanda səfər qeydə alınır və burada toplanır.
            </Txt>
          ) : (
            <Card style={{ marginTop: space.md, paddingVertical: space.xs }}>
              {trips.slice(0, 12).map((t, i) => (
                <React.Fragment key={t.id}>
                  {i > 0 && <Divider />}
                  <Row style={{ paddingVertical: 10 }} gap={space.md}>
                    <StoreAvatar store={getStore(t.store_id)} size={32} />
                    <View style={{ flex: 1 }}>
                      <Txt v="body" style={{ fontSize: 14 }}>
                        {getStore(t.store_id).name} · {t.items} məhsul
                      </Txt>
                      <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                        {new Date(t.created_at).toLocaleDateString('az-AZ')} · {Number(t.total).toFixed(2)} ₼
                      </Txt>
                    </View>
                    <Txt v="bodyStrong" color={colors.success}>
                      −{Number(t.saving).toFixed(2)} ₼
                    </Txt>
                  </Row>
                </React.Fragment>
              ))}
            </Card>
          )}
        </PlusLock>

        {/* The month as a statement: spent, kept, where. One card per month,
            the current one first, each shareable as a line of text. */}
        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          {t('report.title')}
        </Txt>
        {months.length === 0 ? (
          <Txt v="caption" color={colors.gray} center>
            {t('report.empty')}
          </Txt>
        ) : (
          months.map((m, i) => (
            <Card key={m.key} style={{ marginBottom: space.sm, borderWidth: i === 0 ? 1 : 0, borderColor: colors.primary }} testID={`report-${m.key}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="bodyStrong" style={{ textTransform: 'capitalize' }}>
                  {monthName(m)}
                </Txt>
                <Txt v="caption" color={colors.gray}>
                  {t('report.trips', { n: m.trips })}
                </Txt>
              </Row>
              <Row gap={space.md} style={{ marginTop: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Txt v="title" num>
                    {m.spent.toFixed(2)} ₼
                  </Txt>
                  <Txt v="caption" color={colors.gray}>
                    {t('report.spent')}
                  </Txt>
                </View>
                <View style={{ flex: 1 }}>
                  <Txt v="title" num color={colors.success}>
                    −{m.saved.toFixed(2)} ₼
                  </Txt>
                  <Txt v="caption" color={colors.gray}>
                    {t('report.saved')}
                  </Txt>
                </View>
              </Row>
              {m.topStore && (
                <Row gap={8} style={{ marginTop: space.sm }}>
                  <StoreAvatar store={getStore(m.topStore)} size={22} />
                  <Txt v="caption" color={colors.gray}>
                    {t('report.topStore', { store: getStore(m.topStore).name })}
                  </Txt>
                </Row>
              )}
              <Btn title={t('report.share')} variant="ghost" size="md" full={false} icon="share-social-outline" onPress={() => shareReport(m)} style={{ marginTop: space.xs, alignSelf: 'flex-start', paddingHorizontal: 0 }} />
            </Card>
          ))
        )}

        <Btn title={hasBasket ? t('sav.viewBasket') : t('sav.addProduct')} icon={hasBasket ? 'basket' : 'add'} variant="dark" onPress={() => router.push(hasBasket ? '/basket' : '/search')} style={{ marginTop: space.xl }} />
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <Txt v="display" num>
        {value}
      </Txt>
      <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  shareCard: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: space.xl, marginBottom: space.sm },
  hero: { backgroundColor: colors.success, borderRadius: radius.xl, padding: space.xl },
});
