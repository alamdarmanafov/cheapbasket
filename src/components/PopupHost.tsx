import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Txt } from './ui';
import { useBasket } from '@/store/basket';
import { fetchPopups, pickPopup, readLog, recordView, type Popup } from '@/lib/popups';

/**
 * Shows one admin-authored announcement over the app, at most as often as that
 * popup allows. Mounted once at the tab layout so it survives tab switches and
 * cannot fire twice from two screens.
 */
export function PopupHost() {
  const router = useRouter();
  const { isPlus } = useBasket();
  const [popup, setPopup] = useState<Popup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [popups, log] = await Promise.all([fetchPopups(), readLog()]);
      if (cancelled) return;
      const next = pickPopup(popups, isPlus, log);
      if (!next) return;
      setPopup(next);
      // Counted on display, not on dismissal — a popup the user swipes away has
      // still been shown, and should count against the cap.
      recordView(next.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlus]);

  if (!popup) return null;

  const onCta = () => {
    const link = popup.ctaLink?.trim();
    setPopup(null);
    if (!link) return;
    if (/^https?:\/\//i.test(link)) Linking.openURL(link).catch(() => undefined);
    else router.push(link as never);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setPopup(null)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable onPress={() => setPopup(null)} style={styles.close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Bağla">
            <Ionicons name="close" size={20} color={colors.gray} />
          </Pressable>

          {popup.imageUrl ? <Image source={{ uri: popup.imageUrl }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}

          <View style={{ padding: space.lg }}>
            <Txt v="title" center style={{ fontSize: 20, lineHeight: 26 }}>
              {popup.title}
            </Txt>
            <Txt v="body" color={colors.gray} center style={{ marginTop: space.sm }}>
              {popup.body}
            </Txt>
            {popup.ctaLabel ? (
              <Btn title={popup.ctaLabel} onPress={onCta} style={{ marginTop: space.lg }} />
            ) : (
              <Btn title="Bağla" variant="secondary" onPress={() => setPopup(null)} style={{ marginTop: space.lg }} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', ...shadow.card },
  image: { width: '100%', height: 160 },
  close: { position: 'absolute', top: 10, right: 10, zIndex: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
});
