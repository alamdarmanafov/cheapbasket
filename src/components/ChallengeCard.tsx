import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { Row, Txt } from './ui';
import { useAuth } from '@/store/auth';
import { useMyStats } from '@/lib/badges';
import { useT } from '@/lib/i18n';

/**
 * "Write three prices this week, +10." Progress as dots, the week's end as a
 * day, one tap to the scanner. Done for the week: it says so, and stays out
 * of the way until Monday.
 */
export function ChallengeCard() {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const { challenge, reload } = useMyStats(auth.user?.id);
  useFocusEffect(
    React.useCallback(() => {
      reload().catch(() => undefined);
    }, [reload]),
  );
  if (!auth.user || !challenge || challenge.target <= 0 || challenge.bonus <= 0) return null;
  const done = Math.min(challenge.done, challenge.target);
  const complete = challenge.claimed || done >= challenge.target;
  const ends = new Date(challenge.week_ends);
  const daysLeft = Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 86400000));
  return (
    <Pressable onPress={() => (complete ? undefined : router.push('/scan'))} style={({ pressed }) => [styles.card, complete && styles.cardDone, pressed && !complete && { opacity: 0.85 }]} accessibilityRole="button" testID="challenge-card">
      <Row gap={10}>
        <View style={[styles.badge, complete && { backgroundColor: colors.successSoft }]}>
          <Ionicons name={complete ? 'trophy' : 'flag'} size={16} color={complete ? colors.success : colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="captionStrong" style={{ fontSize: 13 }}>
            {complete ? t('challenge.doneTitle', { bonus: challenge.bonus }) : t('challenge.title', { n: challenge.target, bonus: challenge.bonus })}
          </Txt>
          <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
            {complete ? t('challenge.doneBody') : t('challenge.body', { done, n: challenge.target, days: daysLeft })}
          </Txt>
        </View>
        <Row gap={4}>
          {Array.from({ length: challenge.target }, (_, i) => (
            <View key={i} style={[styles.dot, i < done && styles.dotOn]} />
          ))}
        </Row>
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.md, marginTop: space.md },
  cardDone: { borderColor: colors.successSoft, backgroundColor: colors.successSoft },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.success },
});
