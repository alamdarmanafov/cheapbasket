import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Card, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { Freshness, OldPrice, PriceLine, ProductArt, StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateView } from '@/components/states';
import { PlusLock, PlusTag } from '@/components/PlusLock';
import { cheapest, getProduct, maxSaving, sortedPrices } from '@/data/products';
import { fetchPriceHistory } from '@/lib/catalog';
import { hasSupabase } from '@/lib/supabase';
import { useBasket } from '@/store/basket';
import { useRefresh } from '@/lib/useRefresh';
import { notify } from '@/lib/confirm';

/** Product comparison + detail: one screen, price first. */
export default function ProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const basket = useBasket();
  const product = getProduct(String(id));
  const [history, setHistory] = useState<number[]>(product?.history ?? []);
  const cheapestStoreId = product ? cheapest(product).store.id : null;
  const productId = product?.id;
  const loadHistory = useCallback(async () => {
    if (!productId || !hasSupabase || !cheapestStoreId) return;
    await fetchPriceHistory(productId, cheapestStoreId).then(setHistory).catch(() => undefined);
  }, [productId, cheapestStoreId]);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);
  const refresh = useRefresh(loadHistory);

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <StateView emoji="🔍" title="Məhsul tapılmadı" body="Bu məhsul bazamızda yoxdur və ya silinib." cta="Axtarışa qayıt" onCta={() => router.replace('/search')} />
        </View>
      </View>
    );
  }

  const prices = sortedPrices(product);
  const c = cheapest(product);
  const saving = maxSaving(product);
  const inBasket = basket.has(product.id);
  const unavailableEverywhere = c.price == null;
  const h = history;
  const hasHistory = h.length >= 2;
  const delta = hasHistory ? h[h.length - 1] - h[0] : 0;
  const best = basket.optimization.best;
  const atBest = best ? product.prices[best.store.id] : null;

  /** System share sheet: cheapest price + link to the web version of this product. */
  const share = async () => {
    const url = `https://cheapbasket.vercel.app/product/${product.id}`;
    const message = c.price != null ? `${product.brand} ${product.name} ${product.size} — ən ucuz ${c.store.name}-da ${c.price.toFixed(2)} ₼. Cheap Basket ilə müqayisə et: ${url}` : `${product.brand} ${product.name} ${product.size} — Cheap Basket: ${url}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> }).share) {
        await (navigator as Navigator & { share: (d: { title: string; text: string; url: string }) => Promise<void> }).share({ title: 'Cheap Basket', text: message, url });
      } else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        notify('Kopyalandı', 'Məhsul linki panoya kopyalandı.');
      } else {
        await Share.share({ message, url, title: 'Cheap Basket' });
      }
    } catch {
      /* user dismissed */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={`${product.brand} ${product.name} ${product.size}`}
        right={<Pressable hitSlop={8} accessibilityLabel="Paylaş" accessibilityRole="button" onPress={share}><Ionicons name="share-outline" size={22} color={colors.dark} /></Pressable>}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} refreshControl={refresh.control}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingHorizontal: space.lg }}>
          <ProductArt product={product} size={180} emojiScale={0.5} />
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.lg }}>
            {product.brand}
          </Txt>
          <Txt v="title" center>
            {product.name}
          </Txt>
          <Row gap={8} style={{ marginTop: space.sm }}>
            <Pill text={product.size} />
            <Pill text={product.category} />
            {product.rating && <Pill icon="star" text={product.rating.toFixed(1)} tone="warning" />}
          </Row>
        </View>

        {/* Cheapest */}
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          {unavailableEverywhere ? (
            <Pill tone="warning" icon="alert-circle" text="Hazırda heç bir marketdə yoxdur" />
          ) : (
            <>
              <Txt v="caption" color={colors.gray}>
                Ən ucuz qiymət
              </Txt>
              {c.regular != null && (
                <Row gap={6} style={{ marginBottom: 2 }}>
                  <OldPrice value={c.regular} />
                  <Pill tone="primary" text={`−${Math.round(((c.regular - (c.price ?? 0)) / c.regular) * 100)}%`} />
                </Row>
              )}
              <Price value={c.price ?? 0} size="xl" color={colors.primary} />
              <Row gap={6} style={{ marginTop: 4 }}>
                <StoreAvatar store={c.store} size={22} />
                <Txt v="bodyStrong">{c.store.name}</Txt>
              </Row>
            </>
          )}
        </View>

        {/* Comparison */}
        <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
            <Txt v="bodyStrong">Qiymət müqayisəsi</Txt>
            <Freshness minutes={product.updatedMinutesAgo} />
          </Row>
          <Card style={{ padding: space.xs }}>
            {prices.map((s, i) => (
              <PriceLine key={s.store.id} item={s} rank={i} best={c.price ?? 0} />
            ))}
          </Card>
          {saving > 0 && (
            <Row gap={8} style={styles.savingNote}>
              <Ionicons name="trending-down" size={18} color={colors.success} />
              <Txt v="captionStrong" color={colors.success} style={{ flex: 1 }}>
                Bu məhsulda {saving.toFixed(2)} ₼-dək qənaət edə bilərsən.
              </Txt>
            </Row>
          )}
          {best && atBest != null && c.price != null && atBest - c.price > 0.05 && (
            <Txt v="caption" color={colors.gray} style={{ marginTop: space.sm }}>
              Sənin marketin {best.store.name}-da {atBest.toFixed(2)} ₼ — səbətin cəminə görə yenə də ora getmək sərfəlidir.
            </Txt>
          )}
        </View>

        {/* History */}
        <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
          <Row gap={8} style={{ marginBottom: space.sm }}>
            <Txt v="bodyStrong">Qiymət tarixçəsi</Txt>
            <PlusTag />
          </Row>
          {!hasHistory ? (
            <Card>
              <Txt v="caption" color={colors.gray}>
                Hələ tarixçə yoxdur — qiymət hər dəyişəndə burada qrafik yığılacaq.
              </Txt>
            </Card>
          ) : (
          <PlusLock feature="Qiymət tarixçəsi" minHeight={220}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="caption" color={colors.gray}>
                Son 30 gün · {c.store.name}
              </Txt>
              <Pill tone={delta > 0 ? 'warning' : delta < 0 ? 'success' : 'neutral'} icon={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'} text={`${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(2)} ₼`} />
            </Row>
            <PriceChart data={h} />
            <Txt v="caption" color={colors.gray} style={{ marginTop: space.sm }}>
              {delta > 0 ? `Son 30 gündə qiymət ${delta.toFixed(2)} ₼ artıb.` : delta < 0 ? `Son 30 gündə qiymət ${Math.abs(delta).toFixed(2)} ₼ ucuzlaşıb.` : 'Son 30 gündə qiymət dəyişməyib.'}
            </Txt>
          </Card>
          </PlusLock>
          )}
        </View>

        {/* AI alternative */}
        <Pressable onPress={() => router.push(`/assistant?product=${product.id}`)} style={({ pressed }) => [styles.aiRow, pressed && { opacity: 0.8 }]}>
          <Txt style={{ fontSize: 22, lineHeight: 28 }}>🤖</Txt>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Row gap={8}>
              <Txt v="bodyStrong">Daha ucuz alternativini tap</Txt>
              <PlusTag />
            </Row>
            <Txt v="caption" color={colors.gray}>
              AI eyni kateqoriyada 3 variant təklif edəcək
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.grayLight} />
        </Pressable>
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.lg }]}>
        {inBasket ? (
          <Row gap={space.sm}>
            <Btn title={`Səbətdədir · ${basket.lines.find((l) => l.product.id === product.id)?.qty ?? 1} ədəd`} variant="secondary" icon="add" style={{ flex: 1 }} onPress={() => basket.add(product)} />
            <Btn title="Səbətə bax" variant="dark" style={{ flex: 1 }} onPress={() => router.push('/basket')} />
          </Row>
        ) : (
          <Btn title="Səbətə əlavə et" icon="add" disabled={unavailableEverywhere} onPress={() => basket.add(product)} />
        )}
      </View>
    </View>
  );
}

/** Simple line chart with gradient fill — no chart library needed. */
function PriceChart({ data }: { data: number[] }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 430) - space.lg * 2 - space.lg * 2;
  const hgt = 120;
  const pad = 12;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (hgt - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${pts[pts.length - 1].x} ${hgt} L ${pts[0].x} ${hgt} Z`;
  const last = pts[pts.length - 1];
  return (
    <View style={{ marginTop: space.md }}>
      <Svg width={w} height={hgt}>
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.18} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#g)" />
        <Path d={line} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={colors.primary} stroke={colors.white} strokeWidth={2} />
      </Svg>
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <Txt v="caption" color={colors.grayLight} num>
          {data[0].toFixed(2)} ₼
        </Txt>
        <Txt v="caption" color={colors.grayLight}>
          30 gün əvvəl → bu gün
        </Txt>
        <Txt v="captionStrong" num>
          {data[data.length - 1].toFixed(2)} ₼
        </Txt>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  savingNote: { marginTop: space.md, backgroundColor: colors.successSoft, padding: space.md, borderRadius: radius.md },
  aiRow: {
    marginHorizontal: space.lg,
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
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
