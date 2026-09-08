import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/store/auth';
import { TabBar } from '@/components/TabBar';
import { PopupHost } from '@/components/PopupHost';

export default function TabsLayout() {
  const auth = useAuth();
  // First launch → onboarding; then login is mandatory (no guest mode).
  if (auth.onboarded === false) return <Redirect href="/onboarding" />;
  if (auth.enabled && !auth.loading && !auth.session) return <Redirect href="/auth" />;
  return (
    <>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="basket" />
        <Tabs.Screen name="markets" />
        <Tabs.Screen name="scan" />
        <Tabs.Screen name="profile" />
      </Tabs>
      {/* Mounted beside the tabs, not inside a screen, so one announcement shows
          once per launch rather than once per tab the user visits. */}
      <PopupHost />
    </>
  );
}
