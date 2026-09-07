import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, space } from '@/theme';
import { IconBtn, Price, Row, Txt } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { PlusTag } from '@/components/PlusLock';
import { useBasket } from '@/store/basket';
import { useCatalog } from '@/store/catalog';
import { useRefresh } from '@/lib/useRefresh';
import { useAuth } from '@/store/auth';
import { registerForPush, unregisterPush } from '@/lib/notifications';
import { notify } from '@/lib/confirm';

const ROWS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; value?: string; route?: string; plus?: boolean }> = [
  { label: 'Mənim məlumatlarım', icon: 'person-outline', route: '/account' },
  { label: 'Lokasiya', icon: 'location-outline' },
  { label: 'Sevimli marketlər', icon: 'storefront-outline' },
  { label: 'Qənaət statistikası', icon: 'trending-up-outline', route: '/savings', plus: true },
  { label: 'Dil', icon: 'language-outline', value: 'Azərbaycan' },
  { label: 'Valyuta', icon: 'cash-outline', value: '₼ AZN' },
  { label: 'Dəstək', icon: 'chatbubble-ellipses-outline' },
  { label: 'Tətbiqi qiymətləndir', icon: 'star-outline' },
];

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPlus, optimization: o } = useBasket();
  const cat = useCatalog();
  const auth = useAuth();
  const refresh = useRefresh();
  const [notif, setNotif] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const displayName = auth.profile?.display_name || auth.user?.user_metadata?.display_name || auth.user?.user_metadata?.full_name || auth.user?.email?.split('@')[0] || 'Qonaq';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'Q';

  const toggleNotif = async (v: boolean) => {
    setNotifBusy(true);
    if (v) {
      const r = await registerForPush(auth.user?.id ?? null);
      if (r.status === 'granted') setNotif(true);
      else if (r.status === 'unsupported') notify('Bildirişlər', 'Push bildirişlər yalnız real cihazda (iOS/Android) işləyir.');
      else notify('Bildirişlər', 'İcazə verilmədi. Telefonun Ayarlarından bildirişləri aç.');
    } else {
      await unregisterPush(auth.user?.id ?? null);
      setNotif(false);
    }
    setNotifBusy(false);
  };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + space.md, padding: space.lg, paddingBottom: space.xxl }} refreshControl={refresh.control}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="title">Profil</Txt>
        <IconBtn name="settings-outline" bg={colors.white} label="Tənzimləmələr" />
      </Row>

      <Pressable onPress={() => router.push(auth.user ? '/account' : '/auth')} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
        <Row gap={12}>
          <View style={styles.avatar}>
            <Txt v="title" color={colors.white}>
              {initial}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong">{displayName}</Txt>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginTop: 2 }}>
              {auth.user ? auth.user.email ?? (auth.user.app_metadata?.provider === 'apple' ? 'Apple hesabı' : 'Google hesabı') : 'Daxil ol və ya qeydiyyatdan keç'}
              {cat.place ? ` · ${cat.place}` : ''}
            </Txt>
          </View>
          {auth.user ? (
            <Pressable onPress={() => auth.signOut()} hitSlop={8}>
              <Txt v="captionStrong" color={colors.primary}>
                Çıxış
              </Txt>
            </Pressable>
          ) : (
            <View style={styles.loginBtn}>
              <Txt v="captionStrong" color={colors.white}>
                Daxil ol
              </Txt>
            </View>
          )}
        </Row>
      </Pressable>

      <Pressable onPress={() => router.push('/plus')} style={({ pressed }) => [styles.plus, pressed && { opacity: 0.92 }]}>
        <Txt style={{ fontSize: 26, lineHeight: 32 }}>⭐</Txt>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Txt v="bodyStrong" color={colors.white}>
            {isPlus ? 'Cheap Basket Plus aktivdir' : 'Cheap Basket Plus'}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
            {isPlus
              ? auth.profile?.planExpiresAt
                ? `${Math.max(0, Math.ceil((new Date(auth.profile.planExpiresAt).getTime() - Date.now()) / 86400000))} gün qalıb · ${new Date(auth.profile.planExpiresAt).toLocaleDateString('az-AZ')}`
                : 'Bütün funksiyalar açıqdır'
              : 'Qiymət tarixçəsi, bildirişlər, AI · 1.99 $ / ay'}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </Pressable>

      <Pressable onPress={() => router.push('/savings')} style={({ pressed }) => [styles.savings, pressed && { opacity: 0.9 }]}>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color="rgba(255,255,255,0.85)">
            {o.saving > 0 ? 'Bu səbətdə qənaət edirsən' : 'Qənaət'}
          </Txt>
          <Price value={o.saving} size="lg" color={colors.white} />
        </View>
        <Txt v="captionStrong" color={colors.white}>
          Ətraflı →
        </Txt>
      </Pressable>

      <View style={styles.rows}>
        <Row style={[styles.row, styles.rowLine]} gap={12}>
          <Ionicons name="notifications-outline" size={20} color={colors.dark} />
          <View style={{ flex: 1 }}>
            <Row gap={8}>
              <Txt v="body" style={{ fontSize: 13 }}>
                Qiymət düşüşü bildirişi
              </Txt>
              {!isPlus && <PlusTag />}
            </Row>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
              Səbətindəki məhsul ucuzlaşanda
            </Txt>
          </View>
          <Switch value={notif} disabled={notifBusy || !isPlus} onValueChange={toggleNotif} trackColor={{ true: colors.primary, false: colors.line }} thumbColor={colors.white} />
        </Row>
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
          Cheap Basket v1.0 · {cat.loading ? 'yüklənir…' : cat.error ? `xəta: ${cat.error}` : `${cat.stores.length} market · ${cat.products.length} məhsul`}
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 17, padding: 14, marginTop: 15, ...shadow.card },
  loginBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plus: { marginTop: 12, borderRadius: 17, backgroundColor: colors.dark, padding: 14, flexDirection: 'row', alignItems: 'center' },
  savings: { marginTop: 12, borderRadius: 17, backgroundColor: colors.success, padding: 16, flexDirection: 'row', alignItems: 'center' },
  rows: { marginTop: 15, backgroundColor: colors.white, borderRadius: 15, overflow: 'hidden', ...shadow.card },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
