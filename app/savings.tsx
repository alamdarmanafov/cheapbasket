import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const thisMonth = trips.filter((t) => monthKey(new Date(t.created_at)) === monthKey(new Date()));
  const monthSaving = thisMonth.reduce((a, t) => a + Number(t.saving), 0);
  const allSaving = trips.reduce((a, t) => a + Number(t.saving), 0);
  const best = o.best;
  const worst = o.worst;
  const hasBasket = lines.length > 0 && !!best;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('sav.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} refreshControl={refresh.control}>
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
              Səbət yarat, qənaəti göstərək
            </Txt>
            <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
              Aylıq statistika alış-verişlər qeydə alındıqca yığılacaq.
            </Txt>
          </Card>
        )}

        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          Alış-veriş tarixçəsi
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
  hero: { backgroundColor: colors.success, borderRadius: radius.xl, padding: space.xl },
});
