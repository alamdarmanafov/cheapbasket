import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Chip, IconBtn, Price, Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';
import { MiniMap } from '@/components/MiniMap';
import { STORES, STORE_IDS, StoreId, USER_LOCATION, nearestBranch } from '@/data/products';
import { useBasket } from '@/store/basket';

/** Full-screen map: the user, the nearest branch of the chosen store, and directions. */
export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ store?: string }>();
  const { lines, count, optimization: o } = useBasket();
  const bestStore = o.best?.store.id;
  const initial = (STORE_IDS.includes(params.store as StoreId) ? params.store : bestStore ?? 'araz') as StoreId;
  const [storeId, setStoreId] = useState<StoreId>(initial);

  useEffect(() => {
    if (params.store && STORE_IDS.includes(params.store as StoreId)) setStoreId(params.store as StoreId);
  }, [params.store]);

  const branch = nearestBranch(storeId);
  const total = useMemo(() => lines.reduce((a, l) => a + (l.product.prices[storeId] ?? 0) * l.qty, 0), [lines, storeId]);
  const missing = lines.filter((l) => l.product.prices[storeId] == null).length;
  const mapW = Math.min(width, 430);
  const mapH = Math.min(height, 844);

  const openDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${USER_LOCATION.lat},${USER_LOCATION.lng}&destination=${branch.lat},${branch.lng}&travelmode=walking`;
    Linking.openURL(url).catch(() => undefined);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF0EA' }}>
      <View style={{ alignSelf: 'center' }}>
        <MiniMap width={mapW} height={mapH} branch={branch} />
      </View>

      <Row gap={space.sm} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg }}>
        <IconBtn name="chevron-back" bg={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/markets'))} label="Geri" />
        <Row gap={6} style={{ flex: 1, flexWrap: 'wrap' }}>
          {STORE_IDS.map((id) => (
            <Chip key={id} text={STORES[id].name + (id === bestStore && lines.length ? ' 🏆' : '')} active={id === storeId} onPress={() => setStoreId(id)} />
          ))}
        </Row>
      </Row>

      <View style={[styles.card, { paddingBottom: insets.bottom + space.md }]}>
        <Row gap={space.md}>
          <StoreAvatar store={STORES[storeId]} size={44} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Txt v="bodyStrong">{branch.name}</Txt>
              {storeId === bestStore && lines.length > 0 && <Txt style={{ fontSize: 14, lineHeight: 18 }}>🏆</Txt>}
            </Row>
            <Txt v="caption" color={colors.gray} numberOfLines={1}>
              {branch.address}
            </Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt v="bodyStrong" num>
              {branch.distanceKm} km
            </Txt>
            <Txt v="caption" color={colors.gray}>
              🚶 {branch.walkMinutes} dəq
            </Txt>
          </View>
        </Row>

        <View style={styles.summary}>
          {lines.length === 0 ? (
            <Pressable onPress={() => router.push('/search')} style={{ flex: 1 }}>
              <Txt v="caption" color={colors.gray}>
                Səbətin boşdur
              </Txt>
              <Txt v="captionStrong" color={colors.primary}>
                Məhsul əlavə et, ən sərfəli marketi göstərək →
              </Txt>
            </Pressable>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Txt v="caption" color={colors.gray}>
                  Səbətin · {count} məhsul
                </Txt>
                <Price value={total} size="md" />
              </View>
              {missing > 0 ? (
                <Txt v="caption" color={colors.warning}>
                  {missing} məhsul yoxdur
                </Txt>
              ) : storeId === bestStore ? (
                <Txt v="captionStrong" color={colors.success}>
                  Ən sərfəli ✓
                </Txt>
              ) : (
                <Txt v="caption" color={colors.gray}>
                  +{(total - (o.best?.total ?? 0)).toFixed(2)} ₼
                </Txt>
              )}
            </>
          )}
        </View>

        <Btn title="Marşruta bax" icon="navigate" onPress={openDirections} style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    ...shadow.card,
  },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md, marginTop: space.md },
});
