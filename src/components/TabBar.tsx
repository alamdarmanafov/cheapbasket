import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { colors, space } from '@/theme';
import { Txt } from './ui';
import { useBasket } from '@/store/basket';

const META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Ana səhifə', icon: 'home-outline', active: 'home' },
  basket: { label: 'Səbət', icon: 'basket-outline', active: 'basket' },
  markets: { label: 'Marketlər', icon: 'storefront-outline', active: 'storefront' },
  scan: { label: 'Skan et', icon: 'scan-outline', active: 'scan' },
  profile: { label: 'Profil', icon: 'person-outline', active: 'person' },
};

/** Five flat tabs, as in the design. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const basket = useBasket();
  const isScan = state.routes[state.index]?.name === 'scan';

  return (
    <View style={[styles.bar, isScan && styles.barDark, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes
        .filter((r) => META[r.name])
        .map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          const m = META[route.name];
          const color = focused ? colors.primary : isScan ? 'rgba(255,255,255,0.6)' : colors.gray;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <View>
                <Ionicons name={focused ? m.active : m.icon} size={23} color={color} />
                {route.name === 'basket' && basket.count > 0 && (
                  <View style={styles.badge}>
                    <Txt v="captionStrong" color={colors.white} style={{ fontSize: 10, lineHeight: 12 }}>
                      {basket.count}
                    </Txt>
                  </View>
                )}
              </View>
              <Txt v="captionStrong" color={color} style={{ fontSize: 10, lineHeight: 13, marginTop: 4 }}>
                {m.label}
              </Txt>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingHorizontal: space.sm,
  },
  barDark: { backgroundColor: '#151515', borderTopColor: '#2A2A2A' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, minHeight: 48 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
