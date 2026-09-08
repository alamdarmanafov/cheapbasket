import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { useRefresh } from '@/lib/useRefresh';
import { Btn, Card, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { ProductArt, StoreAvatar } from '@/components/product';
import { BranchList } from '@/components/BranchList';
import { StateView } from '@/components/states';
import { suggestSubstitute } from '@/lib/substitute';
import { PlusTag } from '@/components/PlusLock';
import { isOpenNow, storeLabel, nearestBranch } from '@/data/products';
import { useBasket } from '@/store/basket';
import { useCatalog } from '@/store/catalog';
import { useT } from '@/lib/i18n';

type View2 = 'best' | 'branches';

/**
 * "Marketlər": two views behind one tab — the AI's best store for the basket,
 * and every store's branches with distance and a maps link.
 */
export default function Markets() {
  const refresh = useRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ view?: string; store?: string }>();
  const { lines, count, optimization: o, chosenStore, setChosenStore, isPlus, add, remove } = useBasket();
  const { branches, stores, locationGranted, requestLocation } = useCatalog();
  const t = useT();

  const [view, setView] = useState<View2>(params.view === 'branches' ? 'branches' : 'best');
  const [branchFilter, setBranchFilter] = useState<string>(params.store ?? 'all');

  // "Filiallara bax" from the basket arrives as params; apply them once, then clear
  // so returning to this tab later keeps whatever view the user last picked.
  useEffect(() => {
    if (params.view !== 'branches') return;
    setView('branches');
    if (params.store) setBranchFilter(params.store);
    router.setParams({ view: undefined, store: undefined });
  }, [params.view, params.store, router]);

  // Location is asked for here rather than at launch: this is the first screen
  // where it buys the user anything (branch distances). Null means undecided, so
  // the question is put once and never again after an answer either way.
  useFocusEffect(
    useCallback(() => {
      if (locationGranted === null) requestLocation({ interactive: true });
    }, [locationGranted, requestLocation]),
  );

  const subtitle =
    view === 'branches'
      ? t('markets.subtitleBranches', { branches: branches.length, stores: stores.length })
      : lines.length
        ? t('markets.subtitleBasket', { count, stores: o.ranked.length })
        : t('markets.subtitleEmpty');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md }}>
      <Row style={{ paddingHorizontal: space.lg, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Txt v="title">{t('markets.title')}</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Txt>
        </View>
        {view === 'branches' && (
          <Pressable
            onPress={() => requestLocation({ interactive: true })}
            style={[styles.gpsBtn, locationGranted === true && styles.gpsBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={t('markets.enableLocation')}
          >
            <Ionicons name={locationGranted === true ? 'location' : 'location-outline'} size={20} color={locationGranted === true ? colors.white : colors.primary} />
          </Pressable>
        )}
      </Row>

      {/* Segmented switch */}
      <Row gap={0} style={styles.seg}>
        {(['best', 'branches'] as View2[]).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === v }}
            style={[styles.segBtn, view === v && styles.segBtnActive]}
          >
            <Txt v="captionStrong" color={view === v ? colors.dark : colors.gray}>
              {t(v === 'best' ? 'markets.segBest' : 'markets.segBranches')}
            </Txt>
          </Pressable>
        ))}
      </Row>

      {view === 'branches' ? (
        <BranchList filter={branchFilter} onFilterChange={setBranchFilter} />
      ) : (
        <BestStoreView
          {...{ lines, o, chosenStore, setChosenStore, isPlus, add, remove, router, refresh }}
          onSeeBranches={(storeId) => {
            setBranchFilter(storeId);
            setView('branches');
          }}
        />
      )}
    </View>
  );
}

/** The cheapest-store result for the current basket. */
function BestStoreView({
  lines,
  o,
  chosenStore,
  setChosenStore,
  isPlus,
  add,
  remove,
  router,
  refresh,
  onSeeBranches,
}: {
  lines: ReturnType<typeof useBasket>['lines'];
  o: ReturnType<typeof useBasket>['optimization'];
  chosenStore: ReturnType<typeof useBasket>['chosenStore'];
  setChosenStore: ReturnType<typeof useBasket>['setChosenStore'];
  isPlus: boolean;
  add: ReturnType<typeof useBasket>['add'];
  remove: ReturnType<typeof useBasket>['remove'];
  router: ReturnType<typeof useRouter>;
  refresh: ReturnType<typeof useRefresh>;
  onSeeBranches: (storeId: string) => void;
}) {
  const t = useT();

  if (lines.length === 0 || !o.best) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} refreshControl={refresh.control}>
        <StateView emoji="🏪" title={t('markets.emptyTitle')} body={t('markets.emptyBody')} cta={t('markets.emptyCta')} onCta={() => router.push('/search')} />
      </ScrollView>
    );
  }

  const best = o.best;
  const chosen = o.ranked.find((r) => r.store.id === chosenStore) ?? best;
  const isBest = chosen.store.id === best.store.id;
  const branch = nearestBranch(chosen.store.id);
  const worst = o.worst;
  const maxTotal = Math.max(...o.ranked.map((r) => r.total));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }} refreshControl={refresh.control}>
      {/* Hero result */}
      <View style={styles.hero}>
        <Pill tone={isBest ? 'success' : 'warning'} icon={isBest ? 'checkmark' : 'hand-left-outline'} text={t(isBest ? 'markets.bestPick' : 'markets.yourPick')} />
        <Row gap={space.sm} style={{ marginTop: 12 }}>
          <StoreAvatar store={chosen.store} size={32} />
          <Txt v="title" style={{ fontSize: 20, lineHeight: 26 }}>
            {storeLabel(chosen.store)}
          </Txt>
        </Row>
        <Price value={chosen.total} size="xl" style={{ marginTop: 4 }} />
        {isBest && worst && o.saving > 0 ? (
          <Txt v="captionStrong" color={colors.success} style={{ marginTop: 4 }}>
            {t('markets.cheaperThan', { store: worst.store.name, amount: o.saving.toFixed(2) })}
          </Txt>
        ) : !isBest ? (
          <Txt v="captionStrong" color={colors.warning} style={{ marginTop: 4 }}>
            {t('markets.pricierThan', { store: best.store.name, amount: (chosen.total - best.total).toFixed(2) })}
          </Txt>
        ) : null}
        {chosen.missing.length > 0 && (
          <Txt v="caption" color={colors.warning} center style={{ marginTop: 4 }}>
            {t('markets.missingHere', { count: chosen.missing.length, names: chosen.missing.map((m) => m.product.name).join(', ') })}
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
                  {r.missing.length
                    ? t('markets.missingCount', { count: r.missing.length })
                    : i === 0
                      ? t('markets.segBest')
                      : t('markets.plusAmount', { amount: (r.total - best.total).toFixed(2) })}
                </Txt>
                <View style={[styles.miniBar, { width: `${Math.max(10, (r.total / maxTotal) * 100)}%`, backgroundColor: i === 0 ? colors.success : colors.line }]} />
              </Pressable>
            );
          })}
        </Row>
      </View>

      {/* Nearest branch of the chosen store */}
      {branch ? (
        <View style={[styles.branchCard, { marginTop: 14 }]}>
          <Row gap={space.md} style={{ padding: space.md }}>
            <StoreAvatar store={chosen.store} size={40} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong" numberOfLines={1}>{branch.name}</Txt>
              <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ marginTop: 2 }}>
                {branch.address}
              </Txt>
              <Row gap={space.sm} style={{ marginTop: 4 }}>
                <Txt v="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                  {t('markets.walk', { km: branch.distanceKm, min: branch.walkMinutes })}
                </Txt>
                {isOpenNow(branch) != null && (
                  <Txt v="captionStrong" color={isOpenNow(branch) ? colors.success : colors.warning} style={{ fontSize: 11 }}>
                    {branch.alwaysOpen
                      ? t('common.allDay')
                      : isOpenNow(branch)
                        ? t('common.openUntil', { time: branch.openUntil ?? '' })
                        : t('common.closed')}
                  </Txt>
                )}
              </Row>
            </View>
            <Pressable
              onPress={() => {
                const url = branch.mapsUrl
                  ? branch.mapsUrl
                  : Platform.select({ ios: `maps://maps.apple.com/?daddr=${branch.lat},${branch.lng}`, default: `https://maps.google.com/?q=${branch.lat},${branch.lng}` });
                Linking.openURL(url!).catch(() => Linking.openURL(`https://maps.google.com/?q=${branch.lat},${branch.lng}`));
              }}
              style={styles.navBtn}
              accessibilityRole="button"
              accessibilityLabel={t('markets.openInMaps')}
            >
              <Ionicons name="navigate" size={20} color={colors.primary} />
            </Pressable>
          </Row>
        </View>
      ) : (
        <Card style={{ marginTop: 14 }}>
          <Txt v="caption" color={colors.gray}>
            {t('markets.noBranch', { store: chosen.store.name })}
          </Txt>
        </Card>
      )}
      <Btn title={t('markets.allBranches')} variant="secondary" size="md" icon="location-outline" onPress={() => onSeeBranches(chosen.store.id)} style={{ marginTop: 10 }} />

      {/* Shopping list at the chosen store */}
      <Txt v="bodyStrong" style={{ marginTop: 19, marginBottom: 9 }}>
        {t('markets.shoppingList', { store: chosen.store.name })}
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
                {p != null ? <Price value={p * l.qty} size="sm" /> : <Pill tone="warning" text={t('common.missing')} />}
              </Row>
              {p == null && (() => {
                const alt = suggestSubstitute(l.product, chosen.store.id);
                if (!alt) return null;
                return (
                  <Pressable
                    onPress={() => {
                      if (!isPlus) return router.push('/plus');
                      remove(l.product.id);
                      add(alt.product, l.qty);
                    }}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.altRow, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
                    <Txt v="caption" style={{ flex: 1, marginLeft: 8, fontSize: 12 }} numberOfLines={1}>
                      {t('markets.substitute')} <Txt v="captionStrong" style={{ fontSize: 12 }}>{alt.product.brand} {alt.product.name} {alt.product.size}</Txt> · {(alt.price * l.qty).toFixed(2)} ₼
                    </Txt>
                    {isPlus ? <Txt v="captionStrong" color={colors.primary} style={{ fontSize: 12 }}>{t('markets.swap')}</Txt> : <PlusTag />}
                  </Pressable>
                );
              })()}
            </React.Fragment>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  altRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  hero: { backgroundColor: colors.white, borderRadius: 20, padding: 18, marginTop: 14, alignItems: 'center', ...shadow.card },
  mini: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', overflow: 'hidden' },
  miniActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  miniBar: { height: 3, borderRadius: 2, marginTop: 6, alignSelf: 'flex-start', marginLeft: 4 },
  branchCard: { backgroundColor: colors.white, borderRadius: 18, ...shadow.card },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  gpsBtn: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  gpsBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  seg: { marginHorizontal: space.lg, marginTop: 12, marginBottom: space.md, backgroundColor: colors.fill, borderRadius: radius.pill, padding: 3 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.pill },
  segBtnActive: { backgroundColor: colors.white, ...shadow.card },
});
