import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { Btn, Card, Divider, Price, Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PlusLock } from '@/components/PlusLock';
import { useBasket } from '@/store/basket';

/**
 * Savings — computed from the real basket: best store vs the most expensive
 * full-coverage store, plus the per-store breakdown. Purchase history (monthly
 * totals) is added once shopping trips are recorded.
 */
export default function Savings() {
  const router = useRouter();
  const { lines, count, optimization: o } = useBasket();
  const best = o.best;
  const worst = o.worst;
  const hasBasket = lines.length > 0 && !!best;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Qənaət" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}>
        <View style={styles.hero}>
          <Txt v="body" color="rgba(255,255,255,0.8)">
            {hasBasket ? 'Bu səbətdə qənaət edirsən' : 'Hələ qənaət hesablanmayıb'}
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
          <PlusLock feature="Qənaət statistikası" minHeight={320}>
            <Row gap={space.md} style={{ marginTop: space.lg }}>
              <Stat value={String(count)} label="məhsul müqayisə edildi" />
              <Stat value={String(o.ranked.filter((r) => r.missing.length === 0).length)} label="market tam səbəti təmin edir" />
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
                        {r.missing.length ? `${r.missing.length} məhsul yoxdur` : i === 0 ? 'Ən sərfəli' : `+${(r.total - best.total).toFixed(2)} ₼`}
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

        <Btn title={hasBasket ? 'Səbətə bax' : 'Məhsul əlavə et'} icon={hasBasket ? 'basket' : 'add'} variant="dark" onPress={() => router.push(hasBasket ? '/basket' : '/search')} style={{ marginTop: space.xl }} />
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
