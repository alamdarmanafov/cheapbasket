import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { useT } from '@/lib/i18n';
import { Btn, Txt } from './ui';
import { useBasket } from '@/store/basket';

/** Small "PLUS" tag for rows and titles. */
export function PlusTag() {
  return (
    <View style={styles.tag}>
      <Txt style={{ fontSize: 9, lineHeight: 11, color: colors.white, fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.5 }}>PLUS</Txt>
    </View>
  );
}

/**
 * Wraps a Plus-only feature. Free users see the content dimmed under a lock
 * with a single upgrade action; Plus users see the content as-is.
 */
export function PlusLock({ feature, children, minHeight = 160, fill = false }: { feature: string; children: React.ReactNode; minHeight?: number; fill?: boolean }) {
  const t = useT();
  const { isPlus } = useBasket();
  const router = useRouter();
  if (isPlus) return <>{children}</>;
  return (
    <View style={[{ minHeight, borderRadius: radius.lg, overflow: 'hidden' }, fill && { flex: 1 }]}>
      <View pointerEvents="none" style={[{ opacity: 0.35 }, fill && { flex: 1 }]}>
        {children}
      </View>
      <Pressable onPress={() => router.push('/plus')} style={styles.overlay} accessibilityRole="button" accessibilityLabel={t('plusLock.unlock', { feature })}>
        <View style={styles.lockIcon}>
          <Ionicons name="lock-closed" size={18} color={colors.primary} />
        </View>
        <Txt v="bodyStrong" center style={{ marginTop: space.sm }}>
          {feature}
        </Txt>
        <Txt v="caption" color={colors.gray} center style={{ marginTop: 2 }}>
          Cheap Market AI Plus ilə açılır · 1.99 $ / ay
        </Txt>
        <Btn title={t('plusLock.goPlus')} size="md" full={false} icon="star" onPress={() => router.push('/plus')} style={{ marginTop: space.md, minWidth: 160 }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 6, height: 18, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  lockIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
});
