import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Card, Chip, Divider, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateView } from '@/components/states';
import { StoreAvatar } from '@/components/product';
import { Branch, getStore, isAllDay, isOpenNow } from '@/data/products';
import { useRefresh } from '@/lib/useRefresh';
import { useCatalog } from '@/store/catalog';

/** Every branch of every store, nearest first, with open/closed status; tap → map. */
export default function Nearby() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cat = useCatalog();
  const refresh = useRefresh();
  const [storeFilter, setStoreFilter] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);

  const list = useMemo(() => {
    let b = [...cat.branches].sort((x, y) => x.distanceKm - y.distanceKm);
    if (storeFilter) b = b.filter((x) => x.storeId === storeFilter);
    if (openOnly) b = b.filter((x) => isOpenNow(x) !== false);
    return b;
  }, [cat.branches, storeFilter, openOnly]);

  const status = (b: Branch) => {
    const o = isOpenNow(b);
    if (o === null) return null;
    if (isAllDay(b)) return <Pill tone="success" text="24 saat" />;
    return o ? <Pill tone="success" text={`Açıqdır · ${b.openUntil}-a qədər`} /> : <Pill tone="warning" text={b.openFrom ? `Bağlıdır · ${b.openFrom}-da açılır` : 'Bağlıdır'} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Yaxınlıqdakı marketlər" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} refreshControl={refresh.control}>
        <Pressable onPress={() => cat.requestLocation({ interactive: true })} style={styles.locRow} accessibilityRole="button">
          <Ionicons name={cat.locationGranted ? 'locate' : 'locate-outline'} size={18} color={cat.locationGranted ? colors.success : colors.primary} />
          <Txt v="caption" color={colors.gray} style={{ marginLeft: 8, flex: 1 }}>
            {cat.locationGranted ? `Yerin: ${cat.place ?? 'təyin olundu'} · məsafələr buna görədir` : 'Lokasiyanı aç ki, sənə ən yaxın filiallar çıxsın'}
          </Txt>
          <Ionicons name="chevron-forward" size={16} color={colors.grayLight} />
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: space.md }}>
          <Chip text="Hamısı" active={!storeFilter} onPress={() => setStoreFilter(null)} />
          {cat.stores.map((s) => (
            <Chip key={s.id} text={s.name} active={storeFilter === s.id} onPress={() => setStoreFilter(s.id)} />
          ))}
          <Chip text="🕐 İndi açıq" active={openOnly} onPress={() => setOpenOnly((v) => !v)} />
        </ScrollView>

        {list.length === 0 ? (
          <StateView emoji="🏪" title="Filial tapılmadı" body={openOnly ? 'Hazırda açıq filial yoxdur.' : 'Bu market üçün filial əlavə edilməyib.'} />
        ) : (
          <Card style={{ paddingVertical: space.xs }}>
            {list.map((b, i) => (
              <React.Fragment key={b.id}>
                {i > 0 && <Divider />}
                <Pressable onPress={() => router.push(`/map?store=${b.storeId}&branch=${b.id}`)} style={({ pressed }) => [{ paddingVertical: space.md }, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                  <Row gap={space.md}>
                    <StoreAvatar store={getStore(b.storeId)} size={40} />
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyStrong" numberOfLines={1}>
                        {b.name}
                      </Txt>
                      <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ fontSize: 11 }}>
                        {b.address}
                      </Txt>
                      <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>{status(b)}</View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Txt v="bodyStrong" num>
                        {b.distanceKm} km
                      </Txt>
                      <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                        🚶 {b.walkMinutes} dəq
                      </Txt>
                    </View>
                  </Row>
                </Pressable>
              </React.Fragment>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  locRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: 12 },
});
