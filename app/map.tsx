import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Chip, IconBtn, Price, Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';
import { RealMap } from '@/components/RealMap';
import { StoreId, catalog, getStore, nearestBranch, storeIds } from '@/data/products';
import { Ionicons } from '@expo/vector-icons';
import { useBasket } from '@/store/basket';
import { track } from '@/lib/track';

/** Full-screen map: the user, the nearest branch of the chosen store, and directions. */
export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ store?: string }>();
  const { lines, count, optimization: o } = useBasket();
  const bestStore = o.best?.store.id;
  const ids = storeIds();
  const initial = (ids.includes(params.store as StoreId) ? params.store : bestStore ?? ids[0] ?? '') as StoreId;
  const [storeId, setStoreId] = useState<StoreId>(initial);

  useEffect(() => {
    if (params.store && storeIds().includes(params.store as StoreId)) setStoreId(params.store as StoreId);
  }, [params.store]);

  const branch = nearestBranch(storeId);
  useEffect(() => {
    track('map_open', { store_id: storeId });
  }, [storeId]);
  const total = useMemo(() => lines.reduce((a, l) => a + (l.product.prices[storeId] ?? 0) * l.qty, 0), [lines, storeId]);
  const missing = lines.filter((l) => l.product.prices[storeId] == null).length;
  const mapW = Math.min(width, 430);
  const mapH = Math.min(height, 844);

  const openDirections = () => {
    if (!branch) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${catalog.location.lat},${catalog.location.lng}&destination=${branch.lat},${branch.lng}&travelmode=walking`;
    Linking.openURL(url).catch(() => undefined);
  };
  const openPlace = () => {
    if (!branch) return;
    const url = branch.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch.name)}&query_place_id=&center=${branch.lat},${branch.lng}`;
    Linking.openURL(url).catch(() => undefined);
  };
  const storeBranches = catalog.branches.filter((b) => b.storeId === storeId);

  if (!branch) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Row gap={space.sm} style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }}>
          <IconBtn name="chevron-back" bg={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/markets'))} label="Geri" />
          <Row gap={6} style={{ flex: 1, flexWrap: 'wrap' }}>
            {ids.map((id) => (
              <Chip key={id} text={getStore(id).name} active={id === storeId} onPress={() => setStoreId(id)} />
            ))}
          </Row>
        </Row>
        <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
          <Txt v="title" center>
            Filial tapılmadı
          </Txt>
          <Txt v="caption" color={colors.gray} center style={{ marginTop: space.sm }}>
            {getStore(storeId).name} üçün admin paneldən filial (ad, ünvan, lat, lng) əlavə et.
          </Txt>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF0EA' }}>
      <View style={{ alignSelf: 'center' }}>
        <RealMap width={mapW} height={mapH} branch={branch} others={storeBranches} />
      </View>

      <Row gap={space.sm} style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg }}>
        <IconBtn name="chevron-back" bg={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/markets'))} label="Geri" />
        <Row gap={6} style={{ flex: 1, flexWrap: 'wrap' }}>
          {ids.map((id) => (
            <Chip key={id} text={getStore(id).name + (id === bestStore && lines.length ? ' 🏆' : '')} active={id === storeId} onPress={() => setStoreId(id)} />
          ))}
        </Row>
      </Row>

      <View style={[styles.card, { paddingBottom: insets.bottom + space.md }]}>
        <Row gap={space.md}>
          <StoreAvatar store={getStore(storeId)} size={44} />
          <View style={{ flex: 1 }}>
            <Row gap={6}>
              <Txt v="bodyStrong">{branch.name}</Txt>
              {storeId === bestStore && lines.length > 0 && <Txt style={{ fontSize: 14, lineHeight: 18 }}>🏆</Txt>}
            </Row>
            <Txt v="caption" color={colors.gray} numberOfLines={2}>
              {branch.address}
            </Txt>
            {(branch.openUntil || branch.phone) && (
              <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginTop: 2 }}>
                {branch.openUntil ? `Açıqdır · ${branch.openUntil}-a qədər` : ''}
                {branch.openUntil && branch.phone ? ' · ' : ''}
                {branch.phone ?? ''}
              </Txt>
            )}
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

        <Row gap={space.sm} style={{ marginTop: space.md }}>
          <Btn title="Marşruta bax" icon="navigate" onPress={openDirections} style={{ flex: 1 }} />
          <Pressable onPress={openPlace} accessibilityRole="button" accessibilityLabel="Google Maps-də aç" style={styles.mapsBtn}>
            <Ionicons name="map-outline" size={22} color={colors.dark} />
          </Pressable>
        </Row>
        {storeBranches.length > 1 && (
          <Txt v="caption" color={colors.gray} center style={{ marginTop: space.sm, fontSize: 11 }}>
            {getStore(storeId).name}-ın {storeBranches.length} filialı var · ən yaxını göstərilir
          </Txt>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapsBtn: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' },
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
