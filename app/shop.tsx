import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ProductArt, StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { getStore, isOpenNow, nearestBranch } from '@/data/products';
import { useBasket } from '@/store/basket';
import { useAuth } from '@/store/auth';
import { useT } from '@/lib/i18n';
import { confirmAsync, notify } from '@/lib/confirm';
import { recordTrip } from '@/lib/trips';

/**
 * The basket as a checklist to walk the aisles with.
 *
 * Tick what goes into the trolley, watch the total of what is ticked, and
 * "Done" writes the trip down — savings history, points, the month's board.
 * Ticks survive leaving the screen: a phone goes into a pocket between
 * shelves.
 */
export default function Shop() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { store: storeParam } = useLocalSearchParams<{ store?: string }>();
  const { lines, optimization: o, clear } = useBasket();
  const storeId = storeParam || o.best?.store.id || '';
  const store = getStore(storeId);
  const branch = nearestBranch(storeId);
  const key = `cb_shop_ticks_${storeId}`;

  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((raw) => setTicked(new Set(raw ? (JSON.parse(raw) as string[]) : [])))
      .catch(() => undefined);
  }, [key]);
  const toggle = useCallback(
    (id: string) => {
      setTicked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        AsyncStorage.setItem(key, JSON.stringify([...next])).catch(() => undefined);
        return next;
      });
    },
    [key],
  );

  // Unticked first, in basket order; ticked sink to the bottom.
  const ordered = useMemo(() => [...lines.filter((l) => !ticked.has(l.product.id)), ...lines.filter((l) => ticked.has(l.product.id))], [lines, ticked]);
  const priceOf = (id: string) => lines.find((l) => l.product.id === id)?.product.prices[storeId] ?? null;
  const tickedTotal = [...ticked].reduce((sum, id) => {
    const l = lines.find((x) => x.product.id === id);
    const p = priceOf(id);
    return sum + (l && p != null ? p * l.qty : 0);
  }, 0);
  const rank = o.ranked.find((r) => r.store.id === storeId);

  const finish = async () => {
    if (!auth.user) {
      router.push('/auth');
      return;
    }
    setBusy(true);
    const total = ticked.size ? tickedTotal : (rank?.total ?? 0);
    const saving = rank && o.best ? (rank.store.id === o.best.store.id ? o.saving : Math.max(0, (o.worst?.total ?? rank.total) - rank.total)) : 0;
    const r = await recordTrip({ storeId, branchId: branch?.id ?? null, total, saving, items: ticked.size || lines.length });
    setBusy(false);
    if (r.error) return notify(t('common.error'), r.error);
    await AsyncStorage.removeItem(key).catch(() => undefined);
    notify(t('markets.boughtThanks'), r.earned > 0 ? t('markets.boughtBodyPoints', { n: r.earned }) : t('markets.boughtBody'));
    // Bought means the basket has done its job; offer to start the next one clean.
    if (await confirmAsync(t('shop.clearTitle'), t('shop.clearBody'), t('common.yes'))) clear();
    router.back();
  };

  if (!storeId || lines.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title={t('shop.title')} />
        <StateView emoji="🛒" title={t('basket.emptyTitle')} body={t('basket.emptyBody')} cta={t('basket.addProduct')} onCta={() => router.replace('/search')} />
      </View>
    );
  }

  const open = branch ? isOpenNow(branch) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('shop.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 150 }}>
        <Row gap={space.md}>
          <StoreAvatar store={store} size={40} />
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong">{store.name}</Txt>
            {branch && (
              <Txt v="caption" color={colors.gray} numberOfLines={1}>
                {branch.name} · {t('markets.walk', { km: branch.distanceKm, min: branch.walkMinutes })}
                {open != null ? ` · ${open ? t('common.open') : t('common.closed')}` : ''}
              </Txt>
            )}
          </View>
        </Row>

        <View style={styles.list}>
          {ordered.map((l, i) => {
            const done = ticked.has(l.product.id);
            const p = priceOf(l.product.id);
            return (
              <React.Fragment key={l.product.id}>
                {i > 0 && <Divider />}
                <Pressable onPress={() => toggle(l.product.id)} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.fill }]} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
                  <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done ? colors.success : colors.grayLight} />
                  <View style={{ opacity: done ? 0.45 : 1 }}>
                    <ProductArt product={l.product} size={44} emojiScale={0.6} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10, opacity: done ? 0.5 : 1 }}>
                    <Txt v="captionStrong" numberOfLines={2} style={{ fontSize: 13, textDecorationLine: done ? 'line-through' : 'none' }}>
                      {l.qty > 1 ? `${l.qty}× ` : ''}
                      {l.product.brand} {l.product.name} {l.product.size}
                    </Txt>
                    {p == null && (
                      <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                        <Pill tone="warning" text={t('basket.missingAt', { store: store.name })} />
                      </View>
                    )}
                  </View>
                  {p != null && <Price value={p * l.qty} size="sm" />}
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
          <View>
            <Txt v="caption" color={colors.gray}>
              {t('shop.progress', { done: ticked.size, total: lines.length })}
            </Txt>
            <Price value={tickedTotal} size="lg" />
          </View>
          {rank && (
            <View style={{ alignItems: 'flex-end' }}>
              <Txt v="caption" color={colors.gray}>
                {t('shop.expected')}
              </Txt>
              <Price value={rank.total} size="sm" color={colors.gray} />
            </View>
          )}
        </Row>
        <Btn title={t('shop.done')} icon="checkmark-done" loading={busy} onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.white, borderRadius: 17, paddingHorizontal: 10, marginTop: 14, overflow: 'hidden', ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
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
