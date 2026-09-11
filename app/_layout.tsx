import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { BasketProvider } from '@/store/basket';
import { CatalogProvider } from '@/store/catalog';
import { AuthProvider, useAuth } from '@/store/auth';
import { I18nProvider } from '@/lib/i18n';
import { PhoneFrame } from '@/components/PhoneFrame';
import { CelebrationHost } from '@/components/CelebrationHost';
import { colors } from '@/theme';
import { hasSupabase } from '@/lib/supabase';
import { syncPushToken, useNotificationDeepLink } from '@/lib/notifications';
import { track } from '@/lib/track';
import { View, Text } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** Keeps the device's push token filed under whoever is signed in right now. */
function PushTokenSync() {
  const { user } = useAuth();
  // The user object is replaced on every token refresh; the account is not.
  const synced = useRef<string | null>(null);
  useEffect(() => {
    const id = user?.id ?? null;
    if (!id || synced.current === id) return;
    synced.current = id;
    void syncPushToken(id);
  }, [user]);
  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  useNotificationDeepLink();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
    if (loaded) track('app_open');
  }, [loaded, error]);

  if (!loaded && !error) return null;
  if (!hasSupabase)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.bg }}>
        <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Konfiqurasiya yoxdur</Text>
        <Text style={{ color: colors.gray, textAlign: 'center', marginTop: 8 }}>EXPO_PUBLIC_SUPABASE_URL və EXPO_PUBLIC_SUPABASE_ANON_KEY təyin edilməyib (.env / Vercel / EAS).</Text>
      </View>
    );

  return (
    <I18nProvider>
    <CatalogProvider>
    <AuthProvider>
    <BasketProvider>
      <PushTokenSync />
      <PhoneFrame>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="search" options={{ animation: 'fade' }} />
          <Stack.Screen name="map" />
          <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
          <Stack.Screen name="savings" />
          <Stack.Screen name="plus" options={{ presentation: 'modal' }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account" />
          <Stack.Screen name="deals" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="lists" />
          <Stack.Screen name="referral" />
          <Stack.Screen name="nearby" />
          <Stack.Screen name="feedback" options={{ presentation: 'modal' }} />
          <Stack.Screen name="product/[id]" />
        </Stack>
        {/* Above every screen, so a purchase that completes anywhere is celebrated. */}
        <CelebrationHost />
      </PhoneFrame>
    </BasketProvider>
    </AuthProvider>
    </CatalogProvider>
    </I18nProvider>
  );
}
