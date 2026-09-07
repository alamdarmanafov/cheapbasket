import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Btn, Pill, Price, Row, Txt } from './ui';
import { StoreAvatar } from './product';
import { useBasket } from '@/store/basket';

/**
 * AI result bottom sheet (from the design): one best store for the whole basket.
 * Shows a short "analysing" state first so the AI moment feels deliberate.
 */
export function ResultSheet({ visible, onClose, onShowMap }: { visible: boolean; onClose: () => void; onShowMap: () => void }) {
  const insets = useSafeAreaInsets();
  const { optimization: o, count } = useBasket();
  const [ready, setReady] = useState(false);
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) {
      setReady(false);
      return;
    }
    const t = setTimeout(() => setReady(true), 1300);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [visible, scale]);

  const best = o.best;
  const worst = o.worst;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Bağla" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.handle} />
        {!ready || !best ? (
          <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
            <Animated.View style={[styles.icon, { backgroundColor: colors.primarySoft, transform: [{ scale }] }]}>
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </Animated.View>
            <Txt v="title" center style={{ marginTop: space.md }}>
              AI səbətini analiz edir
            </Txt>
            <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
              {count} məhsul · 4 marketdə qiymətlər yoxlanılır…
            </Txt>
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.icon, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="checkmark-circle" size={30} color={colors.success} />
            </View>
            <Pill tone="success" text="AI nəticəsi" />
            <Txt v="bodyStrong" center style={{ marginTop: space.md }}>
              Sənin üçün ən sərfəli seçim
            </Txt>
            <Row gap={space.sm} style={{ marginTop: 6 }}>
              <StoreAvatar store={best.store} size={28} />
              <Txt v="display" style={{ fontSize: 28, lineHeight: 34 }}>
                {best.store.name} Market
              </Txt>
            </Row>
            <Price value={best.total} size="xl" style={{ marginTop: 4 }} />
            <Txt v="caption" color={colors.gray} center style={{ marginTop: space.sm }}>
              {count} məhsullu səbətin üçün {best.store.name} Market daha sərfəlidir.
            </Txt>
            {best.missing.length > 0 && (
              <Txt v="caption" color={colors.warning} center style={{ marginTop: 4 }}>
                {best.missing.length} məhsul heç bir marketdə tam mövcud deyil.
              </Txt>
            )}
            {worst && o.saving > 0 && (
              <Txt v="captionStrong" color={colors.success} center style={{ marginTop: space.sm }}>
                💚 {worst.store.name}-dan {o.saving.toFixed(2)} ₼ daha ucuzdur
              </Txt>
            )}
            <Btn title="Xəritədə göstər" icon="navigate" onPress={onShowMap} style={{ marginTop: space.lg }} />
            <Btn title="Marketləri müqayisə et" variant="ghost" size="md" onPress={onClose} style={{ marginTop: space.xs }} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: space.xl,
    paddingTop: space.sm,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space.md },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
