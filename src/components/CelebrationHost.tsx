import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { colors, fonts, radius, space } from '@/theme';
import { Txt } from './ui';
import { onCelebrate } from '@/lib/celebrate';

/** How many pieces the burst throws. Enough to read as a shower, few enough to stay smooth. */
const PIECES = 48;
const LIFE = 2600;

const CONFETTI = ['#E53935', '#F59E0B', '#16A34A', '#2563EB', '#EC4899', '#FACC15'];

interface Piece {
  key: number;
  left: number;
  size: number;
  color: string;
  delay: number;
  drift: number;
  spin: number;
  round: boolean;
}

/** One screenful of falling paper, generated per burst so no two look alike. */
function makePieces(width: number): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    key: i,
    left: Math.random() * width,
    size: 7 + Math.random() * 7,
    color: CONFETTI[i % CONFETTI.length],
    delay: Math.random() * 400,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
    round: Math.random() > 0.6,
  }));
}

function Confetti({ piece, height, progress }: { piece: Piece; height: number; progress: Animated.Value }) {
  const fall = progress.interpolate({ inputRange: [0, 1], outputRange: [-40, height + 60] });
  const sway = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, piece.drift, piece.drift * 0.4] });
  const spin = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin * 360}deg`] });
  // Paper turns as it falls, so it should thin out and fill again rather than
  // stay a flat rectangle the whole way down.
  const squash = progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.3, 1, 0.3, 1] });
  const fade = progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: piece.left,
        width: piece.size,
        height: piece.round ? piece.size : piece.size * 1.6,
        borderRadius: piece.round ? piece.size / 2 : 2,
        backgroundColor: piece.color,
        opacity: fade,
        transform: [{ translateY: fall }, { translateX: sway }, { rotate: spin }, { scaleX: squash }],
      }}
    />
  );
}

/**
 * The celebration itself: a shower of confetti and a card that springs in.
 *
 * Built on the Animated API that ships with React Native — no animation library
 * and no native module, so it works in the current build. The haptics are the
 * same success pattern the OS uses for a completed payment, tapped twice so it
 * reads as a small flourish rather than a system beep.
 */
export function CelebrationHost() {
  const [shown, setShown] = useState<{ title: string; body: string } | null>(null);
  // Loaded once and rewound before each play, so a second celebration in the
  // same session starts from the beginning rather than from silence at the end.
  const chime = useAudioPlayer(require('../../assets/sounds/celebrate.mp3'));
  const { width, height } = Dimensions.get('window');
  const pieces = useMemo(() => makePieces(width), [width, shown]);
  const fall = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(card, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShown(null));
  }, [card]);

  useEffect(() => onCelebrate((title, body) => setShown({ title, body })), []);

  useEffect(() => {
    if (!shown) return;
    fall.setValue(0);
    card.setValue(0);
    // The device's silent switch is respected: a celebration is a flourish, not
    // something worth overriding a muted phone for.
    try {
      chime.seekTo(0);
      chime.play();
    } catch {
      /* a missing or busy audio session must never break the animation */
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined), 220);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined), 380);
    }
    Animated.parallel([
      Animated.timing(fall, { toValue: 1, duration: LIFE, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(card, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(close, LIFE);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [shown, fall, card, close, chime]);

  if (!shown) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {pieces.map((p) => (
        <Confetti key={p.key} piece={p} height={height} progress={fall} />
      ))}
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: card,
              transform: [
                { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <Txt style={{ fontSize: 44, lineHeight: 52 }}>🎉</Txt>
          <Txt v="title" color={colors.white} center style={{ marginTop: 6 }}>
            {shown.title}
          </Txt>
          <Txt v="body" color="rgba(255,255,255,0.85)" center style={{ marginTop: 6 }}>
            {shown.body}
          </Txt>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.lg,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    fontFamily: fonts.regular,
  },
});
