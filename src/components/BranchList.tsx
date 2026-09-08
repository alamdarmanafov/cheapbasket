import React, { useMemo } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCatalog } from '@/store/catalog';
import { isOpenNow, Branch } from '@/data/products';
import { colors, fonts, radius, space } from '@/theme';
import { Row, Txt } from './ui';
import { StoreAvatar } from './product';
import { useT } from '@/lib/i18n';

function openMaps(b: Branch) {
  const url = b.mapsUrl
    ? b.mapsUrl
    : Platform.select({
        ios: `maps://maps.apple.com/?daddr=${b.lat},${b.lng}`,
        default: `https://maps.google.com/?q=${b.lat},${b.lng}`,
      });
  Linking.openURL(url!).catch(() => Linking.openURL(`https://maps.google.com/?q=${b.lat},${b.lng}`));
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Store branches with distance, opening state and a Google/Apple Maps link. */
export function BranchList({ filter, onFilterChange }: { filter: string; onFilterChange: (storeId: string) => void }) {
  const { branches, stores, requestLocation, loading } = useCatalog();
  const t = useT();

  const filtered = useMemo(
    () => (filter === 'all' ? branches : branches.filter((b) => b.storeId === filter)),
    [branches, filter],
  );

  const renderBranch = ({ item: b }: { item: Branch }) => {
    const store = stores.find((s) => s.id === b.storeId);
    const openState = isOpenNow(b);
    const isOpen = openState === true;

    return (
      <View style={styles.card}>
        {store ? (
          <StoreAvatar store={store} size={48} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.fill }]}>
            <Txt v="bodyStrong" color={colors.gray}>?</Txt>
          </View>
        )}

        <View style={styles.cardBody}>
          <Txt v="bodyStrong" numberOfLines={1}>{b.name}</Txt>
          <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ marginTop: 2 }}>
            {store?.name ?? b.storeId} · {b.address}
          </Txt>
          <Row gap={space.sm} style={{ marginTop: 6 }}>
            {b.distanceKm != null && b.distanceKm < 999 && (
              <View style={styles.badge}>
                <Ionicons name="navigate-outline" size={11} color={colors.primary} />
                <Txt v="caption" color={colors.primary} style={{ marginLeft: 3, fontFamily: fonts.semibold }}>
                  {fmtDist(b.distanceKm)}
                </Txt>
              </View>
            )}
            {openState !== null && (
              <View style={[styles.badge, { backgroundColor: isOpen ? colors.successSoft : '#FEE2E2' }]}>
                <View style={[styles.dot, { backgroundColor: isOpen ? colors.success : colors.primary }]} />
                <Txt v="caption" color={isOpen ? colors.success : colors.primary} style={{ marginLeft: 4, fontFamily: fonts.semibold }}>
                  {isOpen ? (b.openUntil ? t('common.openUntil', { time: b.openUntil }) : t('common.open')) : t('common.closed')}
                </Txt>
              </View>
            )}
          </Row>
        </View>

        <Pressable
          style={styles.navBtn}
          onPress={() => openMaps(b)}
          accessibilityRole="button"
          accessibilityLabel={t('branches.openIn', { name: b.name })}
          hitSlop={12}
        >
          <Ionicons name="navigate" size={20} color={colors.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {stores.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
          <Pressable style={[styles.chip, filter === 'all' && styles.chipActive]} onPress={() => onFilterChange('all')}>
            <Txt v="captionStrong" color={filter === 'all' ? colors.white : colors.dark}>
              {t('branches.all', { count: branches.length })}
            </Txt>
          </Pressable>
          {stores.map((s) => {
            const count = branches.filter((b) => b.storeId === s.id).length;
            if (!count) return null;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, filter === s.id && styles.chipActive, filter !== s.id && { borderColor: s.color, borderWidth: 1.5 }]}
                onPress={() => onFilterChange(filter === s.id ? 'all' : s.id)}
              >
                <Txt v="captionStrong" color={filter === s.id ? colors.white : colors.dark}>
                  {t('branches.chip', { store: s.name, count })}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

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
              {loading ? t('common.loading') : t('branches.empty')}
            </Txt>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Without flexGrow:0 the row steals the column's spare height and, with the
  // default cross-axis stretch, each chip grows to fill it.
  chipBar: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.fill },
  chipActive: { backgroundColor: colors.primary, borderWidth: 0 },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: space.md, gap: space.md },
  cardBody: { flex: 1, minWidth: 0 },
  avatar: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  navBtn: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sep: { height: space.sm },
  empty: { paddingTop: 60, alignItems: 'center' },
});
