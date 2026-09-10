import { tr } from './i18n';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Show notifications while the app is in the foreground too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushStatus = 'granted' | 'denied' | 'unsupported';

/**
 * Ask for permission, get the Expo push token and store it for this user.
 * Returns the resulting status so the UI can reflect it.
 */
export async function registerForPush(userId: string | null): Promise<{ status: PushStatus; token?: string; error?: string }> {
  if (Platform.OS === 'web' || !Device.isDevice) return { status: 'unsupported' };
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('price-drops', {
        name: tr('notif.channel'),
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#E53935',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { status: 'denied' };

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

    if (supabase && userId) {
      await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });
    }
    return { status: 'granted', token };
  } catch (e) {
    return { status: 'denied', error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Re-files an already-granted push token under the signed-in user.
 *
 * A token is only useful to the alert job if it is attached to a user id — that
 * is how a drop is matched to a basket. Someone who turned notifications on
 * before signing in (or signed in on a second device) had a token stored against
 * nobody, so every "your basket got cheaper" push had nowhere to go. This is
 * silent: it never raises the OS dialog, and does nothing at all if permission
 * was never granted.
 */
export async function syncPushToken(userId: string | null): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice || !userId || !supabase) return;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'token' });
  } catch {
    // Nothing the user asked for is failing here; the next launch tries again.
  }
}

export async function unregisterPush(userId: string | null) {
  if (!supabase || !userId) return;
  await supabase.from('push_tokens').delete().eq('user_id', userId);
}

/** Opens the screen a push carries in `data.url` (e.g. '/deals') when the user taps it. */
export function useNotificationDeepLink() {
  const router = useRouter();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const go = (r: Notifications.NotificationResponse | null) => {
      const url = r?.notification.request.content.data?.url;
      if (typeof url === 'string') setTimeout(() => router.push(url as never), 300);
    };
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [router]);
}
