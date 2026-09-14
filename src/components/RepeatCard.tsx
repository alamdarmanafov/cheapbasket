import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { radius, space } from '@/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { Row, Txt } from './ui';
import { ProductArt } from './product';
import { cheapest } from '@/data/products';
import { useBasket } from '@/store/basket';
import { DueProduct, dueProducts } from '@/lib/purchases';
import { useT } from '@/lib/i18n';

/**
 * "You usually buy milk every five days; it has been six."
 *
 * Built from the purchases this phone has logged (shop screen "Done", the
 * comparison's "I bought here"): once a product has two dates, its rhythm is
 * known, and when the gap is nearly up it appears here, one tap from the
 * basket. Products already in the basket are not nagged about.
 */
export function RepeatCard() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  const basket = useBasket();
  const [due, setDue] = useState<DueProduct[]>([]);
  const inBasket = basket.lines.map((l) => l.product.id).join(',');
  const load = useCallback(() => {
    dueProducts(new Set(inBasket.split(',').filter(Boolean))).then((d) => setDue(d.slice(0, 3))).catch(() => setDue([]));
  }, [inBasket]);
  useEffect(load, [load]);
  useFocusEffect(load);

  if (!due.length) return null;
  return (
    <View style={styles.card} testID="repeat-card">
      <Row gap={8} style={{ marginBottom: space.sm }}>
        <View style={styles.badge}>
          <Ionicons name="refresh" size={14} color={colors.primary} />
        </View>
        <Txt v="bodyStrong" style={{ flex: 1 }}>
          {t('repeat.title')}
        </Txt>
      </Row>
      {due.map((d) => {
        const c = cheapest(d.product);
        return (
          <Row key={d.product.id} gap={10} style={styles.row}>
            <ProductArt product={d.product} size={40} emojiScale={0.6} />
            <View style={{ flex: 1 }}>
              <Txt v="captionStrong" numberOfLines={1} style={{ fontSize: 13 }}>
                {d.product.brand} {d.product.name} {d.product.size}
              </Txt>
              <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ fontSize: 11 }}>
                {t('repeat.body', { days: d.intervalDays })}
                {c.price != null ? ` · ${c.store.name} ${c.price.toFixed(2)} ₼` : ''}
              </Txt>
            </View>
            <Pressable onPress={() => basket.add(d.product)} style={({ pressed }) => [styles.add, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={t('repeat.add')}>
              <Ionicons name="add" size={14} color={colors.onAccent} />
              <Txt v="captionStrong" color={colors.onAccent} style={{ fontSize: 12, marginLeft: 2 }}>
                {t('repeat.add')}
              </Txt>
            </Pressable>
          </Row>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.md, marginTop: space.md },
  badge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  row: { paddingVertical: 6 },
  add: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
}));
