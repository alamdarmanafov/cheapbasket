import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { Btn, Card, Divider, Price, Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PlusLock } from '@/components/PlusLock';
import { STORES } from '@/data/products';

const WEEKS = [
  { label: '1-ci həftə', value: 3.9 },
  { label: '2-ci həftə', value: 5.2 },
  { label: '3-cü həftə', value: 2.8 },
  { label: '4-cü həftə', value: 5.5 },
];

const HISTORY = [
  { date: '4 sen', store: 'araz' as const, items: 10, saved: 2.38 },
  { date: '1 sen', store: 'bravo' as const, items: 6, saved: 1.9 },
  { date: '28 avq', store: 'araz' as const, items: 12, saved: 3.7 },
  { date: '24 avq', store: 'neptun' as const, items: 4, saved: 0.8 },
];

/** Monthly savings — the "end" moment: the app is visibly saving money. */
export default function Savings() {
  const router = useRouter();
  const total = 17.4;
  const max = Math.max(...WEEKS.map((w) => w.value));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Qənaət" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }}>
        <View style={styles.hero}>
          <Txt v="body" color="rgba(255,255,255,0.8)">
            Bu ay nə qədər qənaət etdin?
          </Txt>
          <Price value={total} size="xl" color={colors.white} style={{ marginTop: space.sm }} />
          <Row gap={6} style={{ marginTop: space.sm }}>
            <Ionicons name="trending-up" size={16} color="#A7F3C6" />
            <Txt v="captionStrong" color="#A7F3C6">
              Keçən aydan 4.10 ₼ çox
            </Txt>
          </Row>
        </View>

        <PlusLock feature="Qənaət statistikası" minHeight={420}>
        <Row gap={space.md} style={{ marginTop: space.lg }}>
          <Stat value="28" label="məhsul müqayisə etdin" />
          <Stat value="6" label="dəfə ən ucuz marketi seçdin" />
        </Row>

        <Card style={{ marginTop: space.lg }}>
          <Txt v="bodyStrong">Həftələr üzrə</Txt>
          <Row gap={space.md} style={{ alignItems: 'flex-end', height: 140, marginTop: space.lg }}>
            {WEEKS.map((w) => (
              <View key={w.label} style={{ flex: 1, alignItems: 'center' }}>
                <Txt v="captionStrong" num style={{ marginBottom: 6 }}>
                  {w.value.toFixed(1)}
                </Txt>
                <View style={{ width: '100%', height: (w.value / max) * 90, borderRadius: 8, backgroundColor: w.value === max ? colors.success : colors.successSoft }} />
                <Txt v="caption" color={colors.gray} style={{ marginTop: 6, fontSize: 11 }}>
                  {w.label}
                </Txt>
              </View>
            ))}
          </Row>
        </Card>

        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          Son alış-verişlər
        </Txt>
        <Card style={{ paddingVertical: space.xs }}>
          {HISTORY.map((h, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: space.md }} gap={space.md}>
                <StoreAvatar store={STORES[h.store]} size={36} />
                <View style={{ flex: 1 }}>
                  <Txt v="body">{STORES[h.store].name}</Txt>
                  <Txt v="caption" color={colors.gray}>
                    {h.date} · {h.items} məhsul
                  </Txt>
                </View>
                <Txt v="bodyStrong" color={colors.success} num>
                  +{h.saved.toFixed(2)} ₼
                </Txt>
              </Row>
            </React.Fragment>
          ))}
        </Card>
        </PlusLock>

        <Btn title="Yeni səbət yarat" icon="add" variant="dark" onPress={() => router.push('/search')} style={{ marginTop: space.xl }} />
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
