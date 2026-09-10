import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { colors, radius, space } from '@/theme';
import { Row, Txt } from './ui';
import { useT } from '@/lib/i18n';
import { registerForPush } from '@/lib/notifications';
import { notify } from '@/lib/confirm';
import { useAuth } from '@/store/auth';

const DISMISSED = 'cb_alert_ask_dismissed';

/**
 * Offers price-drop alerts where they mean something: on a basket with things in
 * it.
 *
 * The alert pipeline has been complete for a while — the sweep, the basket
 * match, the 24-hour dedupe — and delivered almost nothing, because turning
 * notifications on was buried behind the bell icon and a settings screen. Nobody
 * goes looking for a feature they have not been told about. Asked once, next to
 * the basket it applies to, and never again after an answer either way.
 */
export function PriceAlertCard({ lines }: { lines: number }) {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' || lines < 2) return;
    let cancelled = false;
    (async () => {
      const [dismissed, perm] = await Promise.all([
        AsyncStorage.getItem(DISMISSED).catch(() => null),
        Notifications.getPermissionsAsync().catch(() => ({ status: 'granted' as const })),
      ]);
      // Already granted means the token is filed and the alerts are coming;
      // there is nothing left to ask for.
      if (!cancelled && !dismissed && perm.status !== 'granted') setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [lines]);

  const dismiss = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(DISMISSED, '1').catch(() => undefined);
  }, []);

  const enable = useCallback(async () => {
    // A token with no user id cannot be matched to a basket, so signing in comes
    // first — the alert would otherwise be granted and still never arrive.
    if (!user) {
      router.push('/auth');
      return;
    }
    setBusy(true);
    const r = await registerForPush(user.id);
    setBusy(false);
    if (r.status === 'granted') {
      notify(t('notif.title'), t('notif.askOn'));
      dismiss();
    } else if (r.status === 'unsupported') {
      notify(t('notif.title'), t('notif.webOnly'));
      dismiss();
    } else {
      notify(t('notif.title'), t('notif.denied'));
      dismiss();
    }
  }, [user, router, t, dismiss]);

  if (!show) return null;

  return (
    <View style={styles.card}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <View style={styles.icon}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="captionStrong" style={{ fontSize: 13 }}>
            {t('notif.askTitle')}
          </Txt>
          <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginTop: 2 }}>
            {t('notif.askBody')}
          </Txt>
          <Pressable onPress={enable} disabled={busy} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.75 }]} accessibilityRole="button">
            <Txt v="captionStrong" color={colors.white} style={{ fontSize: 12 }}>
              {user ? t('notif.askCta') : t('notif.askSignIn')}
            </Txt>
          </Pressable>
        </View>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <Ionicons name="close" size={16} color={colors.grayLight} />
        </Pressable>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
  },
  icon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
});
