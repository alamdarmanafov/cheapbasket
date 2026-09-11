import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Btn, Divider, Pill, Price, Row, Txt } from './ui';
import { Freshness, StoreAvatar } from './product';
import { useBasket } from '@/store/basket';
import { stalestMinutes, storeLabel, storeProductCount } from '@/data/products';
import { useT } from '@/lib/i18n';

/**
 * Market comparison bottom sheet.
 * Shows all stores ranked by basket total, best store highlighted.
 */
export function ResultSheet({ visible, onClose, onShowMap, onGoToStore, onShop }: { visible: boolean; onClose: () => void; onShowMap: () => void; onGoToStore?: (storeId: string) => void; onShop?: (storeId: string) => void }) {
  const insets = useSafeAreaInsets();
  const { optimization: o, count, lines } = useBasket();
  const t = useT();
  const [ready, setReady] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    const t = setTimeout(() => setReady(true), 1200);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [visible, scale]);

  const best = o.best;
  const worst = o.worst;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.handle} />

        {!ready || !best ? (
          /* Loading state */
          <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
            <Animated.View style={[styles.icon, { backgroundColor: colors.primarySoft, transform: [{ scale }] }]}>
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </Animated.View>
            <Txt v="title" center style={{ marginTop: space.md }}>
              {t('result.comparing')}
            </Txt>
            <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
              {t('result.comparingBody', { count })}
            </Txt>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.lg }}>
            {/* Best store header */}
            <View style={{ alignItems: 'center', marginBottom: space.lg }}>
              <View style={[styles.icon, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="checkmark-circle" size={30} color={colors.success} />
              </View>
              <Pill tone="success" text={t('markets.bestPick')} />
              <Txt v="bodyStrong" center style={{ marginTop: space.sm }}>
                {storeLabel(best.store)}
              </Txt>
              <Price value={best.total} size="xl" style={{ marginTop: 2 }} />
              {worst && o.saving > 0 && (
                <Txt v="captionStrong" color={colors.success} center style={{ marginTop: 4 }}>
                  {t('result.cheaperThan', { store: worst.store.name, amount: o.saving.toFixed(2) })}
                </Txt>
              )}
              {best.missing.length > 0 && (
                <Txt v="caption" color={colors.warning} center style={{ marginTop: 4 }}>
                  {t('result.missingCount', { count: best.missing.length })}
                </Txt>
              )}
              {/* The screen where someone decides which shop to walk to is the
                  screen that owes them the age of the prices it is comparing.
                  The oldest line sets it: a total is only as current as its
                  stalest ingredient. */}
              {lines.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Freshness minutes={stalestMinutes(lines.map((l) => l.product))} label={t('result.checked')} />
                </View>
              )}
              {onShop && (
                <Btn title={t('shop.start')} icon="cart" size="md" onPress={() => onShop(best.store.id)} style={{ marginTop: space.md }} />
              )}
              {onGoToStore && (
                <Pressable
                  onPress={() => onGoToStore(best.store.id)}
                  style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="location" size={15} color={colors.white} />
                  <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6 }}>
                    {t('result.seeBranchesShort')}
                  </Txt>
                </Pressable>
              )}
            </View>

            {/* All stores ranked */}
            {o.ranked.length > 1 && (
              <View style={styles.rankCard}>
                <Txt v="captionStrong" color={colors.gray} style={{ marginBottom: space.sm }}>
                  {t('result.allStores')}
                </Txt>
                {o.ranked.map((r, i) => {
                  const isBest = r.store.id === best.store.id;
                  return (
                    <React.Fragment key={r.store.id}>
                      {i > 0 && <Divider />}
                      <Pressable
                        onPress={() => onGoToStore?.(r.store.id)}
                        style={({ pressed }) => [styles.rankRow, isBest && styles.rankRowBest, pressed && { opacity: 0.7 }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('result.seeBranches', { store: r.store.name })}
                      >
                        <Txt v="captionStrong" color={isBest ? colors.success : colors.gray} style={{ width: 18 }}>
                          {i + 1}
                        </Txt>
                        <StoreAvatar store={r.store} size={26} />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Txt v="captionStrong" style={{ fontSize: 13 }}>
                            {storeLabel(r.store)}
                          </Txt>
                          {r.missing.length > 0 && (
                            /* "3 yoxdur" reads as a verdict on the shop; what it
                               actually says is how much of this shop we have
                               listed. The found/total pair and the catalogue size
                               keep the two apart. */
                            <Txt v="caption" color={colors.warning} style={{ fontSize: 11 }} numberOfLines={1}>
                              {t('markets.coverage', { have: lines.length - r.missing.length, total: lines.length })}
                              {storeProductCount(r.store.id) === 0 ? ` · ${t('markets.catalogEmpty')}` : ''}
                            </Txt>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 6, alignSelf: 'center' }}>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Price value={r.total} size="sm" />
                            {isBest && <Pill tone="success" text={t('result.cheapest')} />}
                          </View>
                          {onGoToStore && <Ionicons name="chevron-forward" size={14} color={colors.gray} />}
                        </View>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            )}

            {/* Multi-store split total */}
            {o.cheapestSplitTotal > 0 && o.cheapestSplitTotal < (best.total * 0.95) && (
              <View style={[styles.rankCard, { marginTop: space.sm, backgroundColor: colors.fill }]}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="captionStrong" style={{ fontSize: 12 }}>{t('result.splitTitle')}</Txt>
                    <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>{t('result.splitBody')}</Txt>
                  </View>
                  <Price value={o.cheapestSplitTotal} size="sm" />
                </Row>
              </View>
            )}

            <Btn title={t('common.close')} variant="ghost" size="md" onPress={onClose} style={{ marginTop: space.lg }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: space.xl,
    paddingTop: space.sm,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space.md },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  rankCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  rankRow: {
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
    flexDirection: 'row',
  },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: space.md,
  },
  rankRowBest: {
    backgroundColor: `${colors.success}10`,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    borderRadius: 10,
  },
});
