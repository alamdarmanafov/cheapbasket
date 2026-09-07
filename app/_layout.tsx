import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import { BasketProvider } from '@/store/basket';
import { CatalogProvider } from '@/store/catalog';
import { AuthProvider } from '@/store/auth';
import { PhoneFrame } from '@/components/PhoneFrame';
import { colors } from '@/theme';
import { hasSupabase } from '@/lib/supabase';
import { View, Text } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => undefined);
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
    <CatalogProvider>
    <AuthProvider>
    <BasketProvider>
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
          <Stack.Screen name="product/[id]" />
        </Stack>
      </PhoneFrame>
    </BasketProvider>
    </AuthProvider>
    </CatalogProvider>
  );
}
