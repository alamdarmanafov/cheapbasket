import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/theme';
import { makeStyles, useColors } from '@/lib/theme';
import { Chip, Row, Txt } from '@/components/ui';
import { ProductArt, StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateView } from '@/components/states';
import { PriceReportModal } from '@/components/PriceReportModal';
import { Product, coverage, getStore } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';
import { useStorePrefs } from '@/lib/storePrefs';
import { supabase } from '@/lib/supabase';
import { useT } from '@/lib/i18n';

const STALE_DAYS = 14;

/**
 * "Bravo needs 40 prices" — the list for a walk through one store.
 *
 * Pick a store; what follows is every product the catalogue prices elsewhere
 * but not there (a comparison is born the moment it gets one), then the ones
 * whose price there is older than two weeks. Each row opens the price sheet
 * on that store; the report lands in the admin queue as always. Progress is
 * this week's own reports for the store.
 */
export default function Tasks() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useStyles();
  const cat = useCatalog();
  const auth = useAuth();
  const prefs = useStorePrefs();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [pick, setPick] = useState<Product | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (storeId || !cat.stores.length) return;
    const fav = prefs.favorites?.find((id) => cat.stores.some((s) => s.id === id));
    const nearest = [...cat.branches].sort((a, b) => a.distanceKm - b.distanceKm)[0]?.storeId;
    setStoreId(fav ?? nearest ?? cat.stores[0].id);
  }, [storeId, cat.stores, cat.branches, prefs.favorites]);

  const loadMine = useCallback(() => {
    if (!supabase || !auth.user || !storeId) return;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    supabase.from('price_reports').select('product_id').eq('store_id', storeId).gte('created_at', weekAgo).then(({ data }) => setMine(new Set((data ?? []).map((r) => r.product_id as string))));
  }, [auth.user, storeId]);
  useEffect(loadMine, [loadMine]);

  const { missing, stale } = useMemo(() => {
    if (!storeId) return { missing: [] as Product[], stale: [] as Product[] };
    const missing: Product[] = [];
    const stale: Product[] = [];
    const cut = Date.now() - STALE_DAYS * 86400000;
    for (const p of cat.products) {
      if (mine.has(p.id)) continue;
      if (p.prices[storeId] == null) {
        if (coverage(p) >= 1) missing.push(p);
      } else {
        const at = p.updatedAt?.[storeId];
        if (at && new Date(at).getTime() < cut) stale.push(p);
      }
    }
    // The products priced at the most other stores first: one number there completes the most comparisons.
    missing.sort((a, b) => coverage(b) - coverage(a) || a.name.localeCompare(b.name));
    stale.sort((a, b) => new Date(a.updatedAt?.[storeId] ?? 0).getTime() - new Date(b.updatedAt?.[storeId] ?? 0).getTime());
    return { missing, stale };
  }, [cat.products, storeId, mine]);

  const store = storeId ? getStore(storeId) : null;
  const rowOf = (p: Product, hint: string) => (
    <Pressable key={p.id} onPress={() => setPick(p)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <ProductArt product={p} size={40} emojiScale={0.6} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Txt v="captionStrong" numberOfLines={1} style={{ fontSize: 13 }}>
          {p.brand} {p.name} {p.size}
        </Txt>
        <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ fontSize: 11 }}>
          {hint}
        </Txt>
      </View>
      <Txt v="captionStrong" color={colors.primary}>
        {t('prod.gapCta')}
      </Txt>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('tasks.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }}>
        <Txt v="caption" color={colors.gray} style={{ marginBottom: space.sm }}>
          {t('tasks.body')}
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: space.sm }}>
          {cat.stores.map((s) => (
            <Chip key={s.id} text={s.name} active={s.id === storeId} onPress={() => setStoreId(s.id)} />
          ))}
        </ScrollView>

        {store && (
          <Row gap={10} style={styles.head}>
            <StoreAvatar store={store} size={36} />
            <View style={{ flex: 1 }}>
              <Txt v="bodyStrong">{store.name}</Txt>
              <Txt v="caption" color={colors.gray}>
                {t('tasks.counts', { missing: missing.length, stale: stale.length })}
              </Txt>
            </View>
            {mine.size > 0 && (
              <View style={styles.progress}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Txt v="captionStrong" color={colors.success} style={{ marginLeft: 4, fontSize: 12 }}>
                  {t('tasks.mine', { n: mine.size })}
                </Txt>
              </View>
            )}
          </Row>
        )}

        {!auth.user && (
          <Pressable onPress={() => router.push('/auth')} style={styles.signIn} accessibilityRole="button">
            <Txt v="caption" color={colors.primary}>{t('tasks.signIn')}</Txt>
          </Pressable>
        )}

        {missing.length === 0 && stale.length === 0 ? (
          <StateView emoji="🎉" title={t('tasks.doneTitle')} body={t('tasks.doneBody')} />
        ) : (
          <>
            {missing.length > 0 && (
              <>
                <Txt v="bodyStrong" style={{ marginTop: space.md, marginBottom: space.xs }}>
                  {t('tasks.missing', { n: missing.length })}
                </Txt>
                <View style={styles.card}>{missing.slice(0, 60).map((p) => rowOf(p, t('tasks.missingHint', { n: coverage(p) })))}</View>
              </>
            )}
            {stale.length > 0 && (
              <>
                <Txt v="bodyStrong" style={{ marginTop: space.lg, marginBottom: space.xs }}>
                  {t('tasks.stale', { n: stale.length })}
                </Txt>
                <View style={styles.card}>{stale.slice(0, 40).map((p) => rowOf(p, t('tasks.staleHint', { price: (p.prices[storeId!] ?? 0).toFixed(2), days: Math.round((Date.now() - new Date(p.updatedAt?.[storeId!] ?? 0).getTime()) / 86400000) })))}</View>
              </>
            )}
          </>
        )}
      </ScrollView>
      {pick && (
        <PriceReportModal
          product={pick}
          visible
          initialStore={storeId}
          initialReason="add"
          onClose={() => {
            setPick(null);
            loadMine();
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  head: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.md, marginTop: space.sm },
  progress: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  signIn: { marginTop: space.sm, alignSelf: 'flex-start' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
}));
