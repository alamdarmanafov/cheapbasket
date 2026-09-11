import React from 'react';
import { Pressable, StyleSheet, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Product, Store, cheapest, StorePrice } from '@/data/products';
import { colors, radius, space } from '@/theme';
import { useT } from '@/lib/i18n';
import { Price, Row, Txt } from './ui';
import { useBasket } from '@/store/basket';
import { freshness, freshnessLevel } from '@/lib/format';

/** Product visual on a soft tinted background — stands in for photography. */
export function ProductArt({ product, size = 56, emojiScale = 0.5 }: { product: Product; size?: number; emojiScale?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size >= 120 ? radius.xl : radius.md,
        backgroundColor: product.tint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {product.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={{ width: size, height: size, borderRadius: size >= 120 ? radius.xl : radius.md }} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Txt style={{ fontSize: size * emojiScale, lineHeight: size * emojiScale * 1.25 }}>{product.emoji}</Txt>
      )}
    </View>
  );
}

export function StoreAvatar({ store, size = 32 }: { store: Store; size?: number }) {
  if (store.logo_url) {
    // Logos arrive with their own (often transparent) backgrounds, so they sit on
    // a white disc with a hairline edge — otherwise they dissolve into the page
    // and stop reading as the badge the coloured initial version is.
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.white,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={{ uri: store.logo_url }}
          style={{ width: size * 0.78, height: size * 0.78 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: store.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Txt v="captionStrong" color={colors.white} style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {store.initial}
      </Txt>
    </View>
  );
}

/** A product row with cheapest price and a one-tap add button. */
export function ProductRow({ product, showStore = true }: { product: Product; showStore?: boolean }) {
  const t = useT();
  const router = useRouter();
  const basket = useBasket();
  const c = cheapest(product);
  const inBasket = basket.has(product.id);
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
      accessibilityRole="button"
    >
      <ProductArt product={product} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Txt v="bodyStrong" numberOfLines={1}>
          {product.brand} {product.name}
        </Txt>
        <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ marginTop: 2 }}>
          {product.size}
          {showStore && c.price != null && (
            <>
              {'  ·  '}
              <Txt v="caption" color={colors.success}>
                ən ucuz {c.store.name}
              </Txt>
            </>
          )}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: space.sm }}>
        {c.regular != null && <OldPrice value={c.regular} />}
        {c.price != null ? <Price value={c.price} size="sm" color={c.regular != null ? colors.primary : colors.dark} /> : <Txt v="caption" color={colors.gray}>—</Txt>}
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          basket.add(product);
        }}
        hitSlop={8}
        accessibilityLabel={t('product.addToBasket')}
        style={({ pressed }) => [
          styles.add,
          inBasket && { backgroundColor: colors.successSoft },
          pressed && { transform: [{ scale: 0.9 }] },
        ]}
      >
        <Ionicons name={inBasket ? 'checkmark' : 'add'} size={20} color={inBasket ? colors.success : colors.white} />
      </Pressable>
    </Pressable>
  );
}

/** One line in a price comparison list. */
export function PriceLine({ item, rank, best }: { item: StorePrice; rank: number; best: number }) {
  const t = useT();
  const unavailable = item.price == null;
  const diff = item.price != null ? item.price - best : 0;
  return (
    <Row style={[styles.priceLine, rank === 0 && styles.priceLineBest]}>
      <View style={{ width: 24, alignItems: 'center' }}>
        {rank === 0 ? (
          <Txt style={{ fontSize: 18, lineHeight: 22 }}>🥇</Txt>
        ) : (
          <Txt v="caption" color={colors.grayLight}>
            {rank + 1}
          </Txt>
        )}
      </View>
      <StoreAvatar store={item.store} size={28} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Txt v={rank === 0 ? 'bodyStrong' : 'body'} color={unavailable ? colors.grayLight : colors.dark}>
          {item.store.name}
        </Txt>
        {unavailable ? (
          <Txt v="caption" color={colors.grayLight}>
            {t('prod.unavailableNow')}
          </Txt>
        ) : rank === 0 ? (
          <Txt v="caption" color={colors.success}>
            Ən ucuz qiymət{item.regular != null ? ' · endirim' : ''}
          </Txt>
        ) : item.regular != null ? (
          <Txt v="caption" color={colors.gray}>
            Endirimdə · +{diff.toFixed(2)} ₼ baha
          </Txt>
        ) : (
          <Txt v="caption" color={colors.gray}>
            +{diff.toFixed(2)} ₼ baha
          </Txt>
        )}
      </View>
      {item.price != null ? (
        <View style={{ alignItems: 'flex-end' }}>
          {item.regular != null && <OldPrice value={item.regular} />}
          <Price value={item.price} size="md" color={rank === 0 || item.regular != null ? colors.primary : colors.dark} />
          {item.regular != null && (item.discountEnds || item.discountStarts) && (
            <DiscountRange starts={item.discountStarts} ends={item.discountEnds} />
          )}
        </View>
      ) : (
        <Ionicons name="remove-circle-outline" size={20} color={colors.grayLight} />
      )}
    </Row>
  );
}

/** "DD.MM" from an ISO date string. */
function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

/** Small tag showing the discount validity window: "–27.09" or "20.08–27.09". */
export function DiscountRange({ starts, ends }: { starts?: string; ends?: string }) {
  if (!starts && !ends) return null;
  const label = starts && ends ? `${fmtDate(starts)}–${fmtDate(ends)}` : ends ? `–${fmtDate(ends)}` : `${fmtDate(starts!)}–`;
  return (
    <View style={{ backgroundColor: colors.successSoft, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginTop: 2 }}>
      <Txt v="caption" color={colors.success} style={{ fontSize: 10 }}>🏷 {label}</Txt>
    </View>
  );
}

/** Crossed-out regular price shown above a discounted price. */
export function OldPrice({ value }: { value: number }) {
  return (
    <Txt v="caption" color={colors.grayLight} style={{ textDecorationLine: 'line-through' }}>
      {value.toFixed(2)} ₼
    </Txt>
  );
}

export function Freshness({ minutes, label }: { minutes: number; label?: string }) {
  const t = useT();
  const level = freshnessLevel(minutes);
  const color = level === 'fresh' ? colors.success : level === 'ok' ? colors.warning : colors.gray;
  return (
    <Row gap={6}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Txt v="caption" color={colors.gray}>
        {label ?? t('product.updated')}: {freshness(minutes)}
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.white,
  },
  add: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.md,
  },
  priceLine: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  priceLineBest: {
    backgroundColor: colors.primarySoft,
  },
});
