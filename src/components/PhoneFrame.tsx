import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '@/theme';

/**
 * On a desktop browser the prototype is shown inside a phone-sized frame so the
 * clickable demo reads as a mobile app. On real devices this is a no-op.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < 560) return <>{children}</>;
  return (
    <View style={styles.stage}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#ECECEE', alignItems: 'center', justifyContent: 'center', padding: 24 },
  phone: {
    width: 390,
    height: 844,
    maxHeight: '100%',
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    borderWidth: 10,
    borderColor: '#171717',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 30px 60px rgba(0,0,0,0.25)' } as object) : {}),
  },
});
