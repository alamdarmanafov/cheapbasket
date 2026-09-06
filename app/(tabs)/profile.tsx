import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, space } from '@/theme';
import { IconBtn, Price, Row, Txt } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { PlusTag } from '@/components/PlusLock';
import { useBasket } from '@/store/basket';

const ROWS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; route?: string; plus?: boolean }> = [
  { label: 'Mənim məlumatlarım', icon: 'person-outline' },
  { label: 'Ünvanlarım', icon: 'location-outline', value: 'Nərimanov, Bakı' },
  { label: 'Sevimli marketlər', icon: 'storefront-outline', value: 'Araz, Bravo, Neptun' },
  { label: 'Qənaət statistikası', icon: 'trending-up-outline', value: '17.40 ₼', route: '/savings', plus: true },
  { label: 'Qiymət düşüşü bildirişi', icon: 'notifications-outline', value: 'Açıq', plus: true },
  { label: 'Dil', icon: 'language-outline', value: 'Azərbaycan' },
  { label: 'Valyuta', icon: 'cash-outline', value: '₼ AZN' },
  { label: 'Dəstək', icon: 'chatbubble-ellipses-outline' },
  { label: 'Tətbiqi qiymətləndir', icon: 'star-outline' },
];

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPlus } = useBasket();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + space.md, padding: space.lg, paddingBottom: space.xxl }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="title">Profil</Txt>
        <IconBtn name="settings-outline" bg={colors.white} label="Tənzimləmələr" />
      </Row>

      <Row style={styles.card} gap={12}>
        <View style={styles.avatar}>
          <Txt v="title" color={colors.white}>
            Ə
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="bodyStrong">Ələmdar</Txt>
          <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginTop: 2 }}>
            İstifadəçi hesabı · Bakı
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.grayLight} />
      </Row>

      <Pressable onPress={() => router.push('/plus')} style={({ pressed }) => [styles.plus, pressed && { opacity: 0.92 }]}>
        <Txt style={{ fontSize: 26, lineHeight: 32 }}>⭐</Txt>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Txt v="bodyStrong" color={colors.white}>
            {isPlus ? 'Cheap Basket Plus aktivdir' : 'Cheap Basket Plus'}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
            {isPlus ? 'Bütün funksiyalar açıqdır' : 'Qiymət tarixçəsi, bildirişlər, AI · 1.99 $ / ay'}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </Pressable>

      <Pressable onPress={() => router.push('/savings')} style={({ pressed }) => [styles.savings, pressed && { opacity: 0.9 }]}>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color="rgba(255,255,255,0.85)">
            Bu ay qənaət etdin
          </Txt>
          <Price value={17.4} size="lg" color={colors.white} />
        </View>
        <Txt v="captionStrong" color={colors.white}>
          Ətraflı →
        </Txt>
      </Pressable>

      <View style={styles.rows}>
        {ROWS.map((r, i) => (
          <Pressable
            key={r.label}
            onPress={() => r.route && router.push(r.route as never)}
            style={({ pressed }) => [styles.row, i < ROWS.length - 1 && styles.rowLine, pressed && { backgroundColor: colors.fill }]}
          >
            <Ionicons name={r.icon} size={20} color={colors.dark} />
            <Txt v="body" style={{ marginLeft: 12, fontSize: 13 }}>
              {r.label}
            </Txt>
            <View style={{ flex: 1, marginLeft: 8, alignItems: 'flex-start' }}>{r.plus && !isPlus && <PlusTag />}</View>
            {r.value && (
              <Txt v="caption" color={colors.gray} style={{ marginRight: 6, fontSize: 12 }}>
                {r.value}
              </Txt>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.grayLight} />
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: 'center', marginTop: space.xxl, gap: space.sm }}>
        <LogoMark size={36} />
        <Txt v="caption" color={colors.gray} center>
          Səbətini yarat. Ən sərfəli marketi tap. Get və al.
        </Txt>
        <Txt v="caption" color={colors.grayLight} style={{ fontSize: 11 }}>
          Cheap Basket v1.0
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 17, padding: 14, marginTop: 15, ...shadow.card },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plus: { marginTop: 12, borderRadius: 17, backgroundColor: colors.dark, padding: 14, flexDirection: 'row', alignItems: 'center' },
  savings: { marginTop: 12, borderRadius: 17, backgroundColor: colors.success, padding: 16, flexDirection: 'row', alignItems: 'center' },
  rows: { marginTop: 15, backgroundColor: colors.white, borderRadius: 15, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
