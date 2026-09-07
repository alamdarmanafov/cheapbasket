import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Divider, IconBtn, Pill, Price, Row, Txt } from '@/components/ui';
import { ProductArt } from '@/components/product';
import { StateView } from '@/components/states';
import { ResultSheet } from '@/components/ResultSheet';
import { cheapest } from '@/data/products';
import { useBasket } from '@/store/basket';

export default function Basket() {
  const refresh = useRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ compare?: string }>();
  const { lines, count, setQty, remove, clear, optimization: o, setChosenStore } = useBasket();
  const [showResult, setShowResult] = useState(false);
  const best = o.best;

  // Deep link from the assistant: /basket?compare=1 opens the AI result directly.
  useEffect(() => {
    if (params.compare && lines.length) setShowResult(true);
  }, [params.compare, lines.length]);

  const compare = () => {
    setChosenStore(null);
    setShowResult(true);
  };

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md }}>
        <Txt v="title" style={{ paddingHorizontal: space.lg }}>
          Səbətim
        </Txt>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <StateView
            emoji="🧺"
            title="Səbətin boşdur"
            body="Almaq istədiyin məhsulları əlavə et — hansı marketin ən sərfəli olduğunu deyək."
            cta="Məhsul əlavə et"
            onCta={() => router.push('/search')}
            secondary="Barkodu skan et"
            onSecondary={() => router.push('/scan')}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 180 }} refreshControl={refresh.control}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="title">Səbətim</Txt>
          <IconBtn name="trash-outline" bg={colors.white} onPress={clear} label="Səbəti təmizlə" />
        </Row>
        <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
          {count} məhsul · {best ? `${best.total.toFixed(2)} ₼ (${best.store.name})` : ''}
        </Txt>

        <View style={styles.list}>
          {lines.map((l, i) => {
            const c = cheapest(l.product);
            const atBest = best ? l.product.prices[best.store.id] : null;
            return (
              <React.Fragment key={l.product.id}>
                {i > 0 && <Divider />}
                <Pressable onPress={() => router.push(`/product/${l.product.id}`)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.fill }]}>
                  <ProductArt product={l.product} size={48} emojiScale={0.6} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Txt v="captionStrong" numberOfLines={1} style={{ fontSize: 13 }}>
                      {l.product.brand} {l.product.name} {l.product.size}
                    </Txt>
                    <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                      {c.price != null ? `ən ucuz ${c.store.name} · ${c.price.toFixed(2)} ₼` : 'mövcud deyil'}
                    </Txt>
                    {atBest != null ? (
                      <Price value={atBest * l.qty} size="sm" style={{ marginTop: 4 }} />
                    ) : (
                      <View style={{ marginTop: 4 }}>
                        <Pill tone="warning" text={`${best?.store.name}-da yoxdur`} />
                      </View>
                    )}
                  </View>
                  <Row gap={6}>
                    <StepBtn icon={l.qty === 1 ? 'trash-outline' : 'remove'} onPress={() => (l.qty === 1 ? remove(l.product.id) : setQty(l.product.id, l.qty - 1))} />
                    <Txt v="captionStrong" num style={{ width: 16, textAlign: 'center' }}>
                      {l.qty}
                    </Txt>
                    <StepBtn icon="add" onPress={() => setQty(l.product.id, l.qty + 1)} />
                  </Row>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <Pressable onPress={() => router.push('/search')} style={({ pressed }) => [styles.addProduct, pressed && { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Txt v="bodyStrong" color={colors.primary} style={{ marginLeft: 6 }}>
            Məhsul əlavə et
          </Txt>
        </Pressable>
      </ScrollView>

      {/* Sticky CTA in the thumb zone */}
      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
          <View>
            <Txt v="caption" color={colors.gray}>
              Təxmini cəm · {count} məhsul
            </Txt>
            <Price value={best?.total ?? 0} size="lg" />
          </View>
          {o.saving > 0 && <Pill tone="success" icon="trending-down" text={`${o.saving.toFixed(2)} ₼-dək qənaət`} />}
        </Row>
        <Btn title="Qiymətləri müqayisə et" icon="sparkles" onPress={compare} />
      </View>

      <ResultSheet
        visible={showResult}
        onClose={() => {
          setShowResult(false);
          router.push('/markets');
        }}
        onShowMap={() => {
          setShowResult(false);
          router.push('/markets');
        }}
      />
    </View>
  );
}

function StepBtn({ icon, onPress }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [styles.step, pressed && { backgroundColor: colors.fill }]}>
      <Ionicons name={icon} size={16} color={colors.dark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.white, borderRadius: 17, paddingHorizontal: 10, marginTop: 14, overflow: 'hidden', ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  step: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  addProduct: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DDD',
    backgroundColor: colors.white,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
