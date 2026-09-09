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
