import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Card, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { ProductArt, StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { MiniMap } from '@/components/MiniMap';
import { nearestBranch } from '@/data/products';
import { useBasket } from '@/store/basket';

/**
 * "Marketlər": the AI's best store for the whole basket, every store's total so
 * the user can decide for themselves, and the nearest branch on a map.
 */
export default function Markets() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lines, count, optimization: o, chosenStore, setChosenStore } = useBasket();

  if (lines.length === 0 || !o.best) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md }}>
        <Txt v="title" style={{ paddingHorizontal: space.lg }}>
          Ən sərfəli market
        </Txt>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <StateView emoji="🏪" title="Hələ səbətin yoxdur" body="Məhsul əlavə et — hansı marketə getməyin sərfəli olduğunu göstərək." cta="Məhsul əlavə et" onCta={() => router.push('/search')} />
        </View>
      </View>
    );
  }

  const best = o.best;
  const chosen = o.ranked.find((r) => r.store.id === chosenStore) ?? best;
  const isBest = chosen.store.id === best.store.id;
  const branch = nearestBranch(chosen.store.id);
  const worst = o.worst;
  const maxTotal = Math.max(...o.ranked.map((r) => r.total));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + space.md, padding: space.lg, paddingBottom: space.xxl }}>
      <Txt v="title">Ən sərfəli market</Txt>
      <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
        {count} məhsullu səbətin · 4 market müqayisə edildi
      </Txt>

      {/* Hero result */}
      <View style={styles.hero}>
        <Pill tone={isBest ? 'success' : 'warning'} icon={isBest ? 'checkmark' : 'hand-left-outline'} text={isBest ? 'Ən sərfəli seçim' : 'Sənin seçimin'} />
        <Row gap={space.sm} style={{ marginTop: 12 }}>
          <StoreAvatar store={chosen.store} size={32} />
          <Txt v="title" style={{ fontSize: 20, lineHeight: 26 }}>
            {chosen.store.name} Market
          </Txt>
        </Row>
        <Price value={chosen.total} size="xl" style={{ marginTop: 4 }} />
        {isBest && worst && o.saving > 0 ? (
          <Txt v="captionStrong" color={colors.success} style={{ marginTop: 4 }}>
            🟢 {worst.store.name}-dan {o.saving.toFixed(2)} ₼ daha ucuzdur!
          </Txt>
        ) : !isBest ? (
          <Txt v="captionStrong" color={colors.warning} style={{ marginTop: 4 }}>
            {best.store.name}-dan {(chosen.total - best.total).toFixed(2)} ₼ bahadır
          </Txt>
        ) : null}
        {chosen.missing.length > 0 && (
          <Txt v="caption" color={colors.warning} center style={{ marginTop: 4 }}>
            {chosen.missing.length} məhsul burada yoxdur: {chosen.missing.map((m) => m.product.name).join(', ')}
          </Txt>
        )}

        {/* Mini markets grid — tap to pick a different store */}
        <Row gap={7} style={{ marginTop: 14, alignItems: 'stretch' }}>
          {o.ranked.map((r, i) => {
            const active = r.store.id === chosen.store.id;
            return (
              <Pressable
                key={r.store.id}
                onPress={() => setChosenStore(r.store.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.mini, active && styles.miniActive, pressed && { opacity: 0.8 }]}
              >
                <StoreAvatar store={r.store} size={22} />
                <Txt v="captionStrong" style={{ fontSize: 10, marginTop: 6 }} numberOfLines={1}>
                  {r.store.name}
                </Txt>
                <Txt v="captionStrong" num style={{ fontSize: 12, marginTop: 2 }}>
                  {r.total.toFixed(2)} ₼
                </Txt>
                <Txt v="caption" color={r.missing.length ? colors.warning : i === 0 ? colors.success : colors.gray} style={{ fontSize: 9, marginTop: 2 }} numberOfLines={1}>
                  {r.missing.length ? `${r.missing.length} yoxdur` : i === 0 ? 'Ən sərfəli' : `+${(r.total - best.total).toFixed(2)} ₼`}
                </Txt>
                <View style={[styles.miniBar, { width: `${Math.max(10, (r.total / maxTotal) * 100)}%`, backgroundColor: i === 0 ? colors.success : colors.line }]} />
              </Pressable>
            );
          })}
        </Row>
      </View>

      {/* Map card */}
      {branch ? (
      <Pressable onPress={() => router.push(`/map?store=${chosen.store.id}`)} style={({ pressed }) => [styles.mapCard, pressed && { opacity: 0.95 }]}>
        <MiniMap width={width - space.lg * 2} height={185} branch={branch} />
        <Row style={{ padding: 12 }} gap={space.md}>
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong">{branch.name}</Txt>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginTop: 2 }}>
              {branch.address} · {branch.distanceKm} km · {branch.walkMinutes} dəqiqə
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.grayLight} />
        </Row>
      </Pressable>
      ) : (
        <Card style={{ marginTop: 14 }}>
          <Txt v="caption" color={colors.gray}>
            {chosen.store.name} üçün filial əlavə edilməyib (Supabase → branches).
          </Txt>
        </Card>
      )}
      {branch && <Btn title="Xəritədə göstər" icon="navigate" onPress={() => router.push(`/map?store=${chosen.store.id}`)} style={{ marginTop: 10 }} />}

      {/* Shopping list at the chosen store */}
      <Txt v="bodyStrong" style={{ marginTop: 19, marginBottom: 9 }}>
        {chosen.store.name}-da alacaqların
      </Txt>
      <Card style={{ paddingVertical: space.xs }}>
        {lines.map((l, i) => {
          const p = l.product.prices[chosen.store.id];
          return (
            <React.Fragment key={l.product.id}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: 9 }} gap={10}>
                <ProductArt product={l.product} size={38} emojiScale={0.6} />
                <View style={{ flex: 1 }}>
                  <Txt v="captionStrong" numberOfLines={1}>
                    {l.product.brand} {l.product.name}
                  </Txt>
                  <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                    {l.qty} × {l.product.size}
                  </Txt>
                </View>
                {p != null ? <Price value={p * l.qty} size="sm" /> : <Pill tone="warning" text="Yoxdur" />}
              </Row>
            </React.Fragment>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.white, borderRadius: 20, padding: 18, marginTop: 14, alignItems: 'center', ...shadow.card },
  mini: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', overflow: 'hidden' },
  miniActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  miniBar: { height: 3, borderRadius: 2, marginTop: 6, alignSelf: 'flex-start', marginLeft: 4 },
  mapCard: { marginTop: 14, backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden', ...shadow.card },
});
