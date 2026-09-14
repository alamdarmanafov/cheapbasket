import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '@/theme';
import { Row, Txt } from './ui';
import { ProductArt } from './product';
import { PriceReportModal } from './PriceReportModal';
import { Product, catalog, getStore } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { useBasket } from '@/store/basket';
import { useStorePrefs } from '@/lib/storePrefs';
import { useT } from '@/lib/i18n';

/**
 * "Araz has no price for these. Know it? Write it, +2 points."
 *
 * A product priced at one store cannot be compared, and the person who shops
 * at the other store is the cheapest way to fix that. This picks the store the
 * reader actually goes to (their first favourite, else the nearest branch) and
 * the products they care about (basket first, then the catalogue) that have a
 * price elsewhere but none there. Each row opens the price sheet with the
 * store already chosen.
 */
export function HelpFillCard({ points = 2 }: { points?: number }) {
  const t = useT();
  const cat = useCatalog();
  const basket = useBasket();
  const prefs = useStorePrefs();
  const [pick, setPick] = useState<Product | null>(null);

  const storeId = useMemo(() => {
    const fav = prefs.favorites?.find((id) => cat.stores.some((s) => s.id === id));
    if (fav) return fav;
    const nearest = [...cat.branches].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    return nearest?.storeId ?? cat.stores[0]?.id ?? null;
  }, [prefs.favorites, cat.stores, cat.branches]);

  const items = useMemo(() => {
    if (!storeId) return [];
    const missingHere = (p: Product) => p.prices[storeId] == null && Object.values(p.prices).some((v) => v != null);
    const seen = new Set<string>();
    const out: Product[] = [];
    const take = (p: Product) => {
      if (seen.has(p.id) || !missingHere(p)) return;
      seen.add(p.id);
      out.push(p);
    };
    basket.lines.forEach((l) => take(l.product));
    for (const p of catalog.products) {
      if (out.length >= 4) break;
      take(p);
    }
    return out.slice(0, 4);
  }, [storeId, basket.lines, cat.products]);

  if (!storeId || items.length === 0) return null;
  const store = getStore(storeId);

  return (
    <View style={styles.card}>
      <Row gap={8}>
        <View style={[styles.badge, { backgroundColor: store.color }]}>
          <Txt v="captionStrong" color={colors.white}>{store.initial}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">{t('help.title', { store: store.name })}</Txt>
          <Txt v="caption" color={colors.gray}>{t('help.body', { points })}</Txt>
        </View>
      </Row>
      {items.map((p) => (
        <Pressable key={p.id} onPress={() => setPick(p)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="button">
          <ProductArt product={p} size={34} emojiScale={0.7} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Txt v="captionStrong" numberOfLines={1}>{`${p.brand} ${p.name}`.trim()}</Txt>
            <Txt v="caption" color={colors.gray} numberOfLines={1}>{p.size}</Txt>
          </View>
          <View style={styles.cta}>
            <Ionicons name="pricetag" size={12} color={colors.primary} />
            <Txt v="captionStrong" color={colors.primary} style={{ marginLeft: 4 }}>{t('help.write')}</Txt>
          </View>
        </Pressable>
      ))}
      {pick && <PriceReportModal product={pick} visible onClose={() => setPick(null)} initialStore={storeId} initialReason="add" />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, backgroundColor: colors.white, borderRadius: 17, padding: 15 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  cta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
});
