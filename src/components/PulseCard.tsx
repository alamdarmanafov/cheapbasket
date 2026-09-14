import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { radius, space } from '@/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { Row, Txt } from './ui';
import { cheapest } from '@/data/products';
import { useBasket } from '@/store/basket';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n';

interface Hist { product_id: string; store_id: string; price: number; recorded_at: string }

/**
 * The week's pulse for this basket: what the cheapest total was seven days
 * ago against today, and the three lines that moved most.
 *
 * "As of seven days ago" is the last recorded price before that moment, per
 * product and store, from `price_history`; today is the catalogue. A basket
 * with fewer than two lines, or no history yet, shows nothing rather than a
 * zero.
 */
export function PulseCard() {
  const colors = useColors();
  const styles = useStyles();
  const t = useT();
  const router = useRouter();
  const { lines } = useBasket();
  const [hist, setHist] = useState<Hist[] | null>(null);

  const ids = useMemo(() => lines.map((l) => l.product.id).sort().join(','), [lines]);
  useEffect(() => {
    if (!supabase || lines.length < 2) {
      setHist(null);
      return;
    }
    let alive = true;
    supabase
      .from('price_history')
      .select('product_id, store_id, price, recorded_at')
      .in('product_id', lines.map((l) => l.product.id))
      .gte('recorded_at', new Date(Date.now() - 21 * 86400000).toISOString())
      .order('recorded_at', { ascending: true })
      .limit(2000)
      .then(({ data }) => alive && setHist((data ?? []) as Hist[]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const pulse = useMemo(() => {
    if (!hist || hist.length === 0) return null;
    const cutoff = Date.now() - 7 * 86400000;
    // Price per (product, store) as of the cutoff: the last record before it.
    const then = new Map<string, number>();
    for (const h of hist) if (new Date(h.recorded_at).getTime() <= cutoff) then.set(`${h.product_id}|${h.store_id}`, Number(h.price));
    let totalThen = 0, totalNow = 0, covered = 0;
    const moves: Array<{ name: string; delta: number }> = [];
    for (const l of lines) {
      const now = cheapest(l.product).price;
      let best: number | null = null;
      for (const [k, v] of then) if (k.startsWith(`${l.product.id}|`) && (best == null || v < best)) best = v;
      if (now == null || best == null) continue;
      covered++;
      totalThen += best * l.qty;
      totalNow += now * l.qty;
      if (Math.abs(now - best) >= 0.01) moves.push({ name: `${l.product.brand} ${l.product.name}`.trim(), delta: now - best });
    }
    if (covered < 2 || totalThen === 0) return null;
    moves.sort((a, b) => a.delta - b.delta);
    return { totalThen, totalNow, pct: ((totalNow - totalThen) / totalThen) * 100, moves: moves.slice(0, 3) };
  }, [hist, lines]);

  if (!pulse) return null;
  const down = pulse.totalNow <= pulse.totalThen;
  const tone = down ? colors.success : colors.primary;

  return (
    <View style={styles.card}>
      <Row gap={8}>
        <Ionicons name={down ? 'trending-down' : 'trending-up'} size={20} color={tone} />
        <Txt v="bodyStrong" style={{ flex: 1 }}>{t('pulse.title')}</Txt>
        <Txt v="bodyStrong" color={tone} num>
          {pulse.pct > 0 ? '+' : ''}{pulse.pct.toFixed(1)}%
        </Txt>
      </Row>
      <Txt v="caption" color={colors.gray} style={{ marginTop: 4 }}>
        {t('pulse.body', { then: pulse.totalThen.toFixed(2), now: pulse.totalNow.toFixed(2) })}
      </Txt>
      {pulse.moves.map((m) => (
        <Row key={m.name} style={{ marginTop: 6 }} gap={6}>
          <Txt v="caption" style={{ flex: 1 }} numberOfLines={1}>{m.name}</Txt>
          <Txt v="captionStrong" color={m.delta < 0 ? colors.success : colors.primary} num>
            {m.delta < 0 ? '−' : '+'}{Math.abs(m.delta).toFixed(2)} ₼
          </Txt>
        </Row>
      ))}
      <Pressable onPress={() => router.push('/deals')} style={styles.link} accessibilityRole="button">
        <Txt v="captionStrong" color={colors.primary}>{t('pulse.allDeals')}</Txt>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { marginTop: 14, backgroundColor: colors.white, borderRadius: 17, padding: 15 },
  link: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4, paddingRight: 4, borderRadius: radius.pill },
}));
