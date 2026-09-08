'use client';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalog } from '@/store/catalog';
import { isOpenNow, Branch } from '@/data/products';
import { colors, fonts, radius, space } from '@/theme';
import { Row, Txt } from '@/components/ui';
import { StoreAvatar } from '@/components/product';

function openMaps(b: Branch) {
  const url =
    b.mapsUrl
      ? b.mapsUrl
      : Platform.select({
          ios: `maps://maps.apple.com/?daddr=${b.lat},${b.lng}`,
          default: `https://maps.google.com/?q=${b.lat},${b.lng}`,
        });
  Linking.openURL(url!).catch(() =>
    Linking.openURL(`https://maps.google.com/?q=${b.lat},${b.lng}`)
  );
}

function fmtDist(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export default function PlacesScreen() {
  const insets = useSafeAreaInsets();
  const { branches, stores, locationGranted, requestLocation, loading } = useCatalog();
  const [filter, setFilter] = useState<string>('all');

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? branches
        : branches.filter((b) => b.storeId === filter),
    [branches, filter]
  );

  const renderBranch = ({ item: b }: { item: Branch }) => {
    const store = stores.find((s) => s.id === b.storeId);
    const openState = isOpenNow(b);
    const isOpen = openState === true;
    const isUnknown = openState === null;

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          {store ? (
            <StoreAvatar store={store} size={48} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
              <Txt v="bodyStrong" color={colors.gray}>?</Txt>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <Txt v="bodyStrong" numberOfLines={1}>{b.name}</Txt>
          <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ marginTop: 2 }}>
            {store?.name ?? b.storeId} · {b.address}
          </Txt>
          <Row gap={space.sm} style={{ marginTop: 6 }}>
            {/* Distance badge */}
            {b.distanceKm != null && b.distanceKm < 999 && (
              <View style={styles.badge}>
                <Ionicons name="navigate-outline" size={11} color={colors.primary} />
                <Txt v="caption" color={colors.primary} style={{ marginLeft: 3, fontFamily: fonts.semibold }}>
                  {fmtDist(b.distanceKm)}
                </Txt>
              </View>
            )}
            {/* Open/closed badge */}
            {!isUnknown && (
              <View style={[styles.badge, { backgroundColor: isOpen ? colors.successSoft : '#FEE2E2' }]}>
                <View style={[styles.dot, { backgroundColor: isOpen ? colors.success : colors.primary }]} />
                <Txt v="caption" color={isOpen ? colors.success : colors.primary} style={{ marginLeft: 4, fontFamily: fonts.semibold }}>
                  {isOpen
                    ? b.openUntil ? `${b.openUntil}-dək` : 'Açıqdır'
                    : 'Bağlıdır'}
                </Txt>
              </View>
            )}
          </Row>
        </View>

        {/* Navigation arrow */}
        <Pressable
          style={styles.navBtn}
          onPress={() => openMaps(b)}
          accessibilityRole="button"
          accessibilityLabel={`${b.name} — xəritədə aç`}
          hitSlop={12}
        >
          <Ionicons name="navigate" size={20} color={colors.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Txt v="title">Filiallar</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
            {branches.length} filial · {stores.length} market
          </Txt>
        </View>
        {/* GPS button */}
        <Pressable
          onPress={() => requestLocation({ interactive: true })}
          style={[styles.gpsBtn, locationGranted === true && styles.gpsBtnActive]}
          accessibilityRole="button"
          accessibilityLabel="Lokasiyamı aç"
        >
          <Ionicons
            name={locationGranted === true ? 'location' : 'location-outline'}
            size={20}
            color={locationGranted === true ? colors.white : colors.primary}
          />
        </Pressable>
      </View>

      {/* Store filter chips */}
      {stores.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Pressable
            style={[styles.chip, filter === 'all' && styles.chipActive]}
            onPress={() => setFilter('all')}
          >
            <Txt
              v="captionStrong"
              color={filter === 'all' ? colors.white : colors.dark}
            >
              Hamısı ({branches.length})
            </Txt>
          </Pressable>
          {stores.map((s) => {
            const count = branches.filter((b) => b.storeId === s.id).length;
            if (!count) return null;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, filter === s.id && styles.chipActive, filter !== s.id && { borderColor: s.color, borderWidth: 1.5 }]}
                onPress={() => setFilter(filter === s.id ? 'all' : s.id)}
              >
                <Txt
                  v="captionStrong"
                  color={filter === s.id ? colors.white : colors.dark}
                >
                  {s.name} ({count})
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Branch list */}
      <FlatList
        data={filtered}
        keyExtractor={(b) => b.id}
        renderItem={renderBranch}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => requestLocation({ interactive: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Txt v="body" color={colors.gray} center>
              {loading ? 'Yüklənir…' : 'Filial tapılmadı.'}
            </Txt>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  gpsBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chips: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.sm,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderWidth: 0,
  },
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
  },
  cardLeft: { flexShrink: 0 },
  cardBody: { flex: 1, minWidth: 0 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sep: { height: space.sm },
  empty: { paddingTop: 60, alignItems: 'center' },
});
