import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { Btn, Divider, Pill, Price, Row, Txt } from './ui';
import { Freshness, StoreAvatar } from './product';
import { PriceAlertCard } from './PriceAlertCard';
import { useBasket } from '@/store/basket';
import { nearestBranch, stalestMinutes, storeLabel, storeProductCount } from '@/data/products';
import { splitPlan } from '@/lib/optimizer';
import { useBudget, useRankMode } from '@/lib/budget';
import { useCatalog } from '@/store/catalog';
import { useT } from '@/lib/i18n';

/**
 * Market comparison bottom sheet.
 * Shows all stores ranked by basket total, best store highlighted.
 */
export function ResultSheet({ visible, onClose, onShowMap, onGoToStore, onShop, onShopSplit }: { visible: boolean; onClose: () => void; onShowMap: () => void; onGoToStore?: (storeId: string) => void; onShop?: (storeId: string) => void; onShopSplit?: (storeId: string, productIds: string[]) => void }) {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { optimization: o, count, lines } = useBasket();
  const t = useT();
  const cat = useCatalog();
  const budget = useBudget();
  // "Cheap" is the comparison's own order. "Near" is the shopper's other
  // question — which of these is a five-minute walk — and it only makes sense
  // once we know where they are.
  const [rankMode, setRankMode] = useRankMode();
  const located = cat.locationGranted === true;
  const kmOf = (storeId: string) => (located ? nearestBranch(storeId)?.distanceKm ?? null : null);
  const [ready, setReady] = useState(false);
  const split = React.useMemo(() => (ready ? splitPlan(lines, o.ranked.map((r) => r.store)) : null), [ready, lines, o.ranked]);
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
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.lg }}>
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
              {/* The cheapest shop and the nearest shop are often not the same
                  one; the difference is what the walk costs. */}
              {located && (() => {
                const withKm = o.ranked.map((r) => ({ r, km: kmOf(r.store.id) })).filter((x): x is { r: typeof o.ranked[number]; km: number } => x.km != null);
                const near = withKm.sort((a, b) => a.km - b.km)[0];
                if (!near) return null;
                const bestKm = kmOf(best.store.id);
                return (
                  <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
                    {near.r.store.id === best.store.id
                      ? t('result.nearestSame', { km: bestKm ?? near.km })
                      : t('result.nearestOther', { store: near.r.store.name, km: near.km, amount: Math.max(0, near.r.total - best.total).toFixed(2) })}
                  </Txt>
                );
              })()}
              {budget != null && (
                <View style={{ marginTop: 6 }}>
                  <Pill tone={best.total <= budget ? 'success' : 'warning'} icon="wallet-outline" text={best.total <= budget ? t('budget.left', { amount: (budget - best.total).toFixed(2) }) : t('budget.over', { amount: (best.total - budget).toFixed(2) })} />
                </View>
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
                  <Ionicons name="location" size={15} color={colors.onAccent} />
                  <Txt v="captionStrong" color={colors.onAccent} style={{ marginLeft: 6 }}>
                    {t('result.seeBranchesShort')}
                  </Txt>
                </Pressable>
              )}
            </View>

            {/* All stores ranked */}
            {o.ranked.length > 1 && (
              <View style={styles.rankCard}>
                <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
                  <Txt v="captionStrong" color={colors.gray}>
                    {t('result.allStores')}
                  </Txt>
                  {located && (
                    <View style={styles.seg}>
                      {(['cheap', 'near'] as const).map((m) => (
                        <Pressable key={m} onPress={() => setRankMode(m)} style={[styles.segBtn, rankMode === m && styles.segBtnActive]} accessibilityRole="button" accessibilityState={{ selected: rankMode === m }} testID={`rank-${m}`}>
                          <Txt v="captionStrong" color={rankMode === m ? colors.white : colors.gray} style={{ fontSize: 11 }}>
                            {t(m === 'cheap' ? 'result.rankCheap' : 'result.rankNear')}
                          </Txt>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </Row>
                {(rankMode === 'near' && located
                  ? [...o.ranked].sort((a, b) => (kmOf(a.store.id) ?? 1e9) - (kmOf(b.store.id) ?? 1e9))
                  : o.ranked
                ).map((r, i) => {
                  const isBest = r.store.id === best.store.id;
                  const km = kmOf(r.store.id);
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
                          {km != null && (
                            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                              {t('result.km', { km })}
                              {!isBest && rankMode === 'near' ? ` · +${(r.total - best.total).toFixed(2)} ₼` : ''}
                            </Txt>
                          )}
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

            {/* Two shops instead of one, when the second trip pays: each half
                is a ready checklist for that shop. */}
            {split && (
              <View style={[styles.rankCard, { marginTop: space.sm, borderColor: colors.success }]} testID="split-plan">
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt v="captionStrong" style={{ fontSize: 13 }}>{t('split.title', { amount: split.saving.toFixed(2) })}</Txt>
                    <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>{t('split.body')}</Txt>
                  </View>
                  <Price value={split.total} size="sm" color={colors.success} />
                </Row>
                {[split.a, split.b].map((side, i) => (
                  <React.Fragment key={side.store.id}>
                    <Divider />
                    <Pressable
                      onPress={() => onShopSplit?.(side.store.id, side.lines.map((l) => l.product.id))}
                      disabled={!onShopSplit}
                      style={({ pressed }) => [styles.rankRow, pressed && { opacity: 0.7 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('split.go', { store: side.store.name })}
                    >
                      <Txt v="captionStrong" color={colors.gray} style={{ width: 18 }}>
                        {i + 1}
                      </Txt>
                      <StoreAvatar store={side.store} size={26} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Txt v="captionStrong" style={{ fontSize: 13 }}>{storeLabel(side.store)}</Txt>
                        <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }} numberOfLines={1}>
                          {t('split.items', { n: side.lines.length })} · {side.lines.slice(0, 3).map((l) => l.product.name).join(', ')}{side.lines.length > 3 ? '…' : ''}
                        </Txt>
                      </View>
                      <Price value={side.total} size="sm" />
                      {onShopSplit && <Ionicons name="chevron-forward" size={14} color={colors.gray} />}
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Multi-store split total */}
            {!split && o.cheapestSplitTotal > 0 && o.cheapestSplitTotal < (best.total * 0.95) && (
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

            {/* The moment someone has just seen what their basket costs is the
                moment "tell me when it gets cheaper" makes sense. */}
            <PriceAlertCard lines={lines.length} />
            <Btn title={t('common.close')} variant="ghost" size="md" onPress={onClose} style={{ marginTop: space.lg }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
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
  seg: { flexDirection: 'row', backgroundColor: colors.fill, borderRadius: radius.pill, padding: 2 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.dark },
  rankRowBest: {
    backgroundColor: `${colors.success}10`,
    marginHorizontal: -space.md,
    paddingHorizontal: space.md,
    borderRadius: 10,
  },
}));
