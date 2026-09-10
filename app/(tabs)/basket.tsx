import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Divider, IconBtn, Pill, Price, Row, Txt } from '@/components/ui';
import { Freshness, ProductArt } from '@/components/product';
import { StateView } from '@/components/states';
import { ResultSheet } from '@/components/ResultSheet';
import { PriceAlertCard } from '@/components/PriceAlertCard';
import { cheapest, stalestMinutes } from '@/data/products';
import { useBasket } from '@/store/basket';
import { track } from '@/lib/track';
import { useT } from '@/lib/i18n';

export default function Basket() {
  const refresh = useRefresh();
  const t = useT();
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
    track('compare', { store_id: o.best?.store.id ?? null, items: lines.length, total: o.best?.total ?? null, saving: o.saving });
    setChosenStore(null);
    setShowResult(true);
  };

  if (lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md }}>
        <Txt v="title" style={{ paddingHorizontal: space.lg }}>
          {t('basket.title')}
        </Txt>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} refreshControl={refresh.control}>
          <StateView
            emoji="🧺"
            title={t('basket.emptyTitle')}
            body={t('basket.emptyBody')}
            cta={t('basket.addProduct')}
            onCta={() => router.push('/search')}
            secondary={t('home.scanBarcode')}
            onSecondary={() => router.push('/scan')}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: 180 }} refreshControl={refresh.control}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="title">{t('basket.title')}</Txt>
          <Row gap={8}>
            <IconBtn name="bookmark-outline" bg={colors.white} onPress={() => router.push('/lists')} label={t('basket.myLists')} />
            <IconBtn name="trash-outline" bg={colors.white} onPress={clear} label={t('basket.clear')} />
          </Row>
        </Row>
        <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
          {best
            ? t('basket.summaryWith', { count, total: best.total.toFixed(2), store: best.store.name })
            : t('home.itemCount', { count })}
        </Txt>
        {/* The total above is only as current as the oldest price in it, and this
            is where the user reads that total. */}
        <View style={{ marginTop: 6 }}>
          <Freshness minutes={stalestMinutes(lines.map((l) => l.product))} label={t('result.checked')} />
        </View>

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
                      {c.price != null ? t('basket.cheapestAt', { store: c.store.name, price: c.price.toFixed(2) }) : t('basket.unavailable')}
                    </Txt>
                    {atBest != null ? (
                      <Price value={atBest * l.qty} size="sm" style={{ marginTop: 4 }} />
                    ) : (
                      <View style={{ marginTop: 4 }}>
                        <Pill tone="warning" text={t('basket.missingAt', { store: best?.store.name ?? '' })} />
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

        <PriceAlertCard lines={lines.length} />

        <Pressable onPress={() => router.push('/search')} style={({ pressed }) => [styles.addProduct, pressed && { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Txt v="bodyStrong" color={colors.primary} style={{ marginLeft: 6 }}>
            {t('basket.addProduct')}
          </Txt>
        </Pressable>
      </ScrollView>

      {/* Sticky CTA in the thumb zone */}
      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
          <View>
            <Txt v="caption" color={colors.gray}>
              {t('basket.estimated', { count })}
            </Txt>
            <Price value={best?.total ?? 0} size="lg" />
          </View>
          {o.saving > 0 && <Pill tone="success" icon="trending-down" text={t('basket.saveUpTo', { amount: o.saving.toFixed(2) })} />}
        </Row>
        <Btn title={t('basket.compare')} icon="sparkles" onPress={compare} />
      </View>

      <ResultSheet
        visible={showResult}
        onClose={() => setShowResult(false)}
        onShowMap={() => {
          setShowResult(false);
          router.push('/markets');
        }}
        onGoToStore={(storeId) => {
          setShowResult(false);
          router.push({ pathname: '/(tabs)/markets', params: { view: 'branches', store: storeId } });
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
