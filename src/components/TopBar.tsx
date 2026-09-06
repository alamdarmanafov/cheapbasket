import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { IconBtn, Row, Txt } from './ui';
import { LogoMark } from './Logo';
import { useCatalog } from '@/store/catalog';

/** Brand + location + notifications, as in the design's top bar. */
export function TopBar() {
  const insets = useSafeAreaInsets();
  const cat = useCatalog();
  const label = cat.place ?? (cat.locationGranted === false ? 'Lokasiya bağlıdır' : cat.locationGranted ? 'Lokasiyan' : 'Lokasiya…');
  return (
    <Row style={[styles.bar, { paddingTop: insets.top + space.sm }]} gap={space.sm}>
      <LogoMark size={36} />
      <View>
        <Txt style={{ fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 13 }}>Cheap</Txt>
        <Txt style={{ fontFamily: fonts.extrabold, fontSize: 12, lineHeight: 13, color: colors.primary }}>Basket</Txt>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable onPress={cat.requestLocation} style={styles.location} accessibilityRole="button">
        <Ionicons name="location-outline" size={14} color={colors.dark} />
        <Txt v="captionStrong" style={{ fontSize: 11, marginLeft: 4 }} numberOfLines={1}>
          {label}
        </Txt>
      </Pressable>
      <IconBtn name="notifications-outline" size={36} label="Bildirişlər" />
    </Row>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: space.lg, paddingBottom: space.sm, backgroundColor: colors.white },
  location: { backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: 10, height: 32, flexDirection: 'row', alignItems: 'center', maxWidth: 190 },
});
