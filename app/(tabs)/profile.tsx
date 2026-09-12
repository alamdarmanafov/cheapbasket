import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { SITE_URL } from '@/lib/links';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow, space } from '@/theme';
import { Price, Row, Txt } from '@/components/ui';
import { LogoMark } from '@/components/Logo';
import { PlusTag } from '@/components/PlusLock';
import { useBasket } from '@/store/basket';
import { useCatalog } from '@/store/catalog';
import { useRefresh } from '@/lib/useRefresh';
import { useAuth } from '@/store/auth';
import { registerForPush, unregisterPush } from '@/lib/notifications';
import * as StoreReview from 'expo-store-review';
import { confirmAsync, notify } from '@/lib/confirm';
import { LANGS, useI18n, type Key } from '@/lib/i18n';

type RowDef = { key: Key; icon: keyof typeof Ionicons.glyphMap; value?: string; route?: string; href?: string; plus?: boolean; action?: 'location' | 'rate' | 'language'; info?: boolean };
const ROWS: RowDef[] = [
  { key: 'profile.rowAccount', icon: 'person-outline', route: '/account' },
  { key: 'profile.rowLocation', icon: 'location-outline', action: 'location' },
  { key: 'profile.rowNotifications', icon: 'notifications-outline', route: '/notifications' },
  { key: 'profile.rowLists', icon: 'list-outline', route: '/lists' },
  { key: 'profile.rowStores', icon: 'storefront-outline', route: '/stores' },
  { key: 'profile.rowReceipt', icon: 'receipt-outline', route: '/receipt' },
  { key: 'profile.rowReferral', icon: 'gift-outline', route: '/referral' },
  { key: 'profile.rowSavings', icon: 'trending-up-outline', route: '/savings', plus: true },
  { key: 'profile.rowLanguage', icon: 'language-outline', action: 'language' },
  { key: 'profile.rowCurrency', icon: 'cash-outline', value: '₼ AZN', info: true },
  { key: 'profile.rowSupport', icon: 'chatbubble-ellipses-outline', route: '/feedback' },
  { key: 'profile.rowRate', icon: 'star-outline', action: 'rate' },
  // The documents the sign-in screen names; reviewers look for them in-app.
  { key: 'profile.rowPrivacy', icon: 'shield-checkmark-outline', href: `${SITE_URL}/privacy` },
  { key: 'profile.rowTerms', icon: 'document-text-outline', href: `${SITE_URL}/terms` },
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
  const [deleting, setDeleting] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { t, lang, setLang } = useI18n();

  /** "12 gün" for a subscription that expires, nothing for one that does not. */
  const plusLeft = (() => {
    const at = auth.profile?.planExpiresAt;
    if (!isPlus || !at) return null;
    const days = Math.max(0, Math.ceil((new Date(at).getTime() - Date.now()) / 86400000));
    return t('profile.plusDaysLeft', { days, date: new Date(at).toLocaleDateString(lang) });
  })();
  const displayName = auth.profile?.display_name || auth.user?.user_metadata?.display_name || auth.user?.user_metadata?.full_name || auth.user?.email?.split('@')[0] || t('profile.guest');
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const toggleNotif = async (v: boolean) => {
    setNotifBusy(true);
    if (v) {
      const r = await registerForPush(auth.user?.id ?? null);
      if (r.status === 'granted') setNotif(true);
      else if (r.status === 'unsupported') notify(t('profile.notifTitle'), t('profile.notifUnsupported'));
      else notify(t('profile.notifTitle'), t('profile.notifDenied'));
    } else {
      await unregisterPush(auth.user?.id ?? null);
      setNotif(false);
    }
    setNotifBusy(false);
  };
  const onRow = async (r: RowDef) => {
    if (r.route) return router.push(r.route as never);
    if (r.href) return Linking.openURL(r.href).catch(() => undefined);
    if (r.action === 'location') return cat.requestLocation({ interactive: true });
    if (r.action === 'language') return setLangOpen(true);
    if (r.action === 'rate') {
      if (Platform.OS !== 'web' && (await StoreReview.hasAction().catch(() => false))) return StoreReview.requestReview();
      return notify(t('profile.thanks'), t('profile.rateLater'));
    }
  };

  const onSignOut = async () => {
    if (await confirmAsync(t('profile.signOut'), t('profile.signOutAsk'), t('profile.signOut'))) await auth.signOut();
  };

  const onDeleteAccount = async () => {
    const ok = await confirmAsync(t('profile.deleteAccount'), t('profile.deleteAsk'), t('common.delete'), true);
    if (!ok) return;
    setDeleting(true);
    const r = await auth.deleteAccount();
    setDeleting(false);
    if (r.error) notify(t('profile.deleteFailed'), r.error);
  };

  const rowValue = (r: RowDef) => {
    if (r.action === 'location') return cat.place ?? t(cat.locationGranted === false ? 'profile.locationOff' : 'profile.locationOn');
    if (r.action === 'language') return LANGS.find((l) => l.id === lang)?.label;
    // The code is issued with the account, so the row can show it outright —
    // no need to open the screen to find out what to send a friend.
    if (r.route === '/referral') return auth.profile?.referralCode ?? (auth.profile?.points ? t('profile.pointsValue', { points: auth.profile.points }) : undefined);
    return r.value;
  };
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + space.md, padding: space.lg, paddingBottom: space.xxl }}
      refreshControl={refresh.control}
      // Without this the pull is only available once the content is taller than
      // the screen — on a short profile (signed out, or a small phone with few
      // rows) there is nothing to pull against and the gesture does nothing.
      alwaysBounceVertical
    >
      <Txt v="title">{t('profile.title')}</Txt>

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
              {auth.user ? auth.user.email ?? t(auth.user.app_metadata?.provider === 'apple' ? 'profile.appleAccount' : 'profile.googleAccount') : t('profile.signInPrompt')}
              {cat.place ? ` · ${cat.place}` : ''}
            </Txt>
          </View>
          {auth.user && (auth.profile?.points ?? 0) > 0 && (
            <Pressable onPress={() => router.push('/referral')} hitSlop={6} style={styles.points} accessibilityRole="button">
              <Txt v="captionStrong" color={colors.dark} style={{ fontSize: 11 }}>
                {t('profile.points', { points: auth.profile?.points ?? 0 })}
              </Txt>
            </Pressable>
          )}
          {auth.user ? (
            <Ionicons name="chevron-forward" size={20} color={colors.grayLight} />
          ) : (
            <View style={styles.loginBtn}>
              <Txt v="captionStrong" color={colors.white}>
                {t('profile.signIn')}
              </Txt>
            </View>
          )}
        </Row>
      </Pressable>

      {/*
        * The Plus card sells Plus, so it is for people who do not have it. A
        * subscriber saw a full-width advert for something they already pay for;
        * their subscription is a row in the list below instead, where the rest
        * of the account settings are.
        */}
      {!isPlus && (
      <Pressable onPress={() => router.push('/plus')} style={({ pressed }) => [styles.plus, pressed && { opacity: 0.92 }]}>
        <Txt style={{ fontSize: 26, lineHeight: 32 }}>⭐</Txt>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Txt v="bodyStrong" color={colors.white}>
            {t(isPlus ? 'profile.plusActive' : 'profile.plusTitle')}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.75)" style={{ fontSize: 11 }}>
            {isPlus
              ? auth.profile?.planExpiresAt
                ? t('profile.plusDaysLeft', {
                    days: Math.max(0, Math.ceil((new Date(auth.profile.planExpiresAt).getTime() - Date.now()) / 86400000)),
                    date: new Date(auth.profile.planExpiresAt).toLocaleDateString(lang),
                  })
                : t('profile.plusAllOpen')
              : t('profile.plusPitch')}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.white} />
      </Pressable>
      )}

      <Pressable onPress={() => router.push('/savings')} style={({ pressed }) => [styles.savings, pressed && { opacity: 0.9 }]}>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color="rgba(255,255,255,0.85)">
            {t(o.saving > 0 ? 'profile.savingNow' : 'profile.saving')}
          </Txt>
          <Price value={o.saving} size="lg" color={colors.white} />
        </View>
        <Txt v="captionStrong" color={colors.white}>
          {t('profile.more')}
        </Txt>
      </Pressable>

      <View style={styles.rows}>
        <Row style={[styles.row, styles.rowLine]} gap={12}>
          <Ionicons name="notifications-outline" size={20} color={colors.dark} />
          <View style={{ flex: 1 }}>
            <Row gap={8}>
              <Txt v="body" style={{ fontSize: 13 }}>
                {t('profile.priceAlert')}
              </Txt>
              {!isPlus && <PlusTag />}
            </Row>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
              {t('profile.priceAlertBody')}
            </Txt>
          </View>
          <Switch value={notif} disabled={notifBusy || !isPlus} onValueChange={toggleNotif} trackColor={{ true: colors.primary, false: colors.line }} thumbColor={colors.white} />
        </Row>
        {isPlus && (
          <Pressable
            onPress={() => router.push('/plus')}
            style={({ pressed }) => [styles.row, styles.rowLine, pressed && { backgroundColor: colors.fill }]}
          >
            <Ionicons name="star-outline" size={20} color={colors.dark} />
            <Txt v="body" style={{ marginLeft: 12, fontSize: 13 }}>
              {t('profile.plusActive')}
            </Txt>
            <View style={{ flex: 1 }} />
            {plusLeft && (
              <Txt v="caption" color={colors.gray} style={{ marginRight: 6, fontSize: 12 }} numberOfLines={1}>
                {plusLeft}
              </Txt>
            )}
            <Ionicons name="chevron-forward" size={18} color={colors.grayLight} />
          </Pressable>
        )}
        {ROWS.map((r, i) => (
          <Pressable
            key={r.key}
            disabled={r.info}
            onPress={() => onRow(r)}
            style={({ pressed }) => [styles.row, i < ROWS.length - 1 && styles.rowLine, pressed && { backgroundColor: colors.fill }]}
          >
            <Ionicons name={r.icon} size={20} color={colors.dark} />
            <Txt v="body" style={{ marginLeft: 12, fontSize: 13 }}>
              {t(r.key)}
            </Txt>
            <View style={{ flex: 1, marginLeft: 8, alignItems: 'flex-start' }}>{r.plus && !isPlus && <PlusTag />}</View>
            {rowValue(r) && (
              <Txt v="caption" color={colors.gray} style={{ marginRight: 6, fontSize: 12 }} numberOfLines={1}>
                {rowValue(r)}
              </Txt>
            )}
            {!r.info && <Ionicons name="chevron-forward" size={18} color={colors.grayLight} />}
          </Pressable>
        ))}
      </View>

      <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.md, fontSize: 11 }}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '' })}
      </Txt>

      {/* Account actions live at the very bottom, away from everyday settings. */}
      {auth.user && (
        <View style={[styles.rows, { marginTop: space.lg }]}>
          <Pressable
            onPress={onSignOut}
            disabled={deleting}
            style={({ pressed }) => [styles.row, styles.rowLine, pressed && { backgroundColor: colors.fill }]}
            accessibilityRole="button"
          >
            <Ionicons name="log-out-outline" size={20} color={colors.dark} />
            <Txt v="body" style={{ marginLeft: 12, fontSize: 13 }}>
              {t('profile.signOut')}
            </Txt>
          </Pressable>
          <Pressable
            onPress={onDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }, deleting && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={20} color={colors.primary} />
            <Txt v="body" color={colors.primary} style={{ marginLeft: 12, fontSize: 13 }}>
              {t(deleting ? 'profile.deleting' : 'profile.deleteAccount')}
            </Txt>
          </Pressable>
        </View>
      )}

      <View style={{ alignItems: 'center', marginTop: space.xxl, gap: space.sm }}>
        <LogoMark size={36} />
        <Txt v="caption" color={colors.gray} center>
          {t('profile.tagline')}
        </Txt>
        <Txt v="caption" color={colors.grayLight} style={{ fontSize: 11 }}>
          Cheap Market AI v1.0 ·{' '}
          {cat.loading
            ? t('common.loading')
            : cat.error
              ? `${t('common.error')}: ${cat.error}`
              : t('profile.stats', { stores: cat.stores.length, products: cat.products.length })}
        </Txt>
      </View>

      <Modal visible={langOpen} transparent animationType="fade" onRequestClose={() => setLangOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLangOpen(false)} accessibilityRole="button">
          {/* Swallows taps so hitting a row does not also close via the backdrop. */}
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Txt v="bodyStrong" center style={{ marginBottom: space.xs }}>
              {t('profile.langTitle')}
            </Txt>
            {LANGS.map((l, i) => (
              <Pressable
                key={l.id}
                onPress={() => {
                  setLang(l.id);
                  setLangOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: l.id === lang }}
                style={({ pressed }) => [styles.langRow, i < LANGS.length - 1 && styles.rowLine, pressed && { backgroundColor: colors.fill }]}
              >
                <Txt style={{ fontSize: 20, lineHeight: 26 }}>{l.flag}</Txt>
                <Txt v="body" style={{ flex: 1, marginLeft: 12, fontSize: 14 }}>
                  {l.label}
                </Txt>
                {l.id === lang && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  points: { backgroundColor: colors.warningSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginRight: 8 },
  card: { backgroundColor: colors.white, borderRadius: 17, padding: 14, marginTop: 15, ...shadow.card },
  loginBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, height: 32, justifyContent: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  plus: { marginTop: 12, borderRadius: 17, backgroundColor: colors.dark, padding: 14, flexDirection: 'row', alignItems: 'center' },
  savings: { marginTop: 12, borderRadius: 17, backgroundColor: colors.success, padding: 16, flexDirection: 'row', alignItems: 'center' },
  rows: { marginTop: 15, backgroundColor: colors.white, borderRadius: 15, overflow: 'hidden', ...shadow.card },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: space.lg },
  sheet: { backgroundColor: colors.white, borderRadius: 18, padding: space.md, ...shadow.card },
  langRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
});
