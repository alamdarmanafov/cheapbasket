import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Btn, Card, Divider, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateView } from '@/components/states';
import { getStore } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useT } from '@/lib/i18n';
import { useRefresh } from '@/lib/useRefresh';

interface Suggestion { id: string; name: string; brand: string; barcode: string | null; suggested_at: string | null }
interface Report { id: string; product_id: string; store_id: string | null; reason: string; price: number | null; resolved: boolean; outcome: string | null; points: number; created_at: string; products: { name: string; brand: string } | null }
interface Ledger { delta: number; reason: string; ref: string | null; created_at: string }

/**
 * Everything this person has given the catalogue, and what came of it.
 *
 * A suggestion or a price that vanishes into the admin panel without a trace
 * is one nobody repeats. Here each one carries its state: waiting, accepted
 * with the points it paid, or declined.
 */
export default function Contributions() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [accepted, setAccepted] = useState<Ledger[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !auth.user) return;
    const [{ data: p }, { data: r }, { data: l }] = await Promise.all([
      supabase.from('pending_products').select('id, name, brand, barcode, suggested_at').eq('suggested_by', auth.user.id).order('suggested_at', { ascending: false }).limit(50),
      supabase.from('price_reports').select('id, product_id, store_id, reason, price, resolved, outcome, points, created_at, products(name, brand)').order('created_at', { ascending: false }).limit(50),
      supabase.from('points_ledger').select('delta, reason, ref, created_at').eq('reason', 'suggestion').order('created_at', { ascending: false }).limit(50),
    ]);
    setPending((p ?? []) as Suggestion[]);
    setReports((r ?? []) as unknown as Report[]);
    setAccepted((l ?? []) as Ledger[]);
    setLoaded(true);
  }, [auth.user]);
  useEffect(() => {
    load();
  }, [load]);
  const refresh = useRefresh(load);

  if (!auth.user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title={t('contrib.title')} />
        <StateView emoji="🙋" title={t('contrib.signInTitle')} body={t('contrib.signInBody')} cta={t('scan.suggestSignIn')} onCta={() => router.push('/auth')} />
      </View>
    );
  }

  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '');
  const empty = loaded && pending.length === 0 && reports.length === 0 && accepted.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('contrib.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} refreshControl={refresh.control}>
        {empty && (
          <StateView emoji="✨" title={t('contrib.emptyTitle')} body={t('contrib.emptyBody')} cta={t('home.scanBarcode')} onCta={() => router.push('/scan')} />
        )}

        {(pending.length > 0 || accepted.length > 0) && (
          <>
            <Txt v="bodyStrong" style={{ marginBottom: space.sm }}>{t('contrib.suggestions')}</Txt>
            <Card style={{ padding: space.xs }}>
              {accepted.map((l, i) => (
                <React.Fragment key={`a${i}`}>
                  {i > 0 && <Divider />}
                  <Row style={styles.row} gap={space.sm}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <Txt v="captionStrong">{t('contrib.acceptedSuggestion')}</Txt>
                      <Txt v="caption" color={colors.gray}>{l.ref ?? ''} · {when(l.created_at)}</Txt>
                    </View>
                    <Pill tone="success" text={`+${l.delta}`} />
                  </Row>
                </React.Fragment>
              ))}
              {pending.map((p, i) => (
                <React.Fragment key={p.id}>
                  {(i > 0 || accepted.length > 0) && <Divider />}
                  <Row style={styles.row} gap={space.sm}>
                    <Ionicons name="time-outline" size={20} color={colors.warning} />
                    <View style={{ flex: 1 }}>
                      <Txt v="captionStrong" numberOfLines={1}>{`${p.brand} ${p.name}`.trim()}</Txt>
                      <Txt v="caption" color={colors.gray}>{p.barcode ?? ''} · {when(p.suggested_at)}</Txt>
                    </View>
                    <Pill tone="warning" text={t('contrib.waiting')} />
                  </Row>
                </React.Fragment>
              ))}
            </Card>
          </>
        )}

        {reports.length > 0 && (
          <>
            <Txt v="bodyStrong" style={{ marginTop: space.lg, marginBottom: space.sm }}>{t('contrib.prices')}</Txt>
            <Card style={{ padding: space.xs }}>
              {reports.map((r, i) => {
                const state = !r.resolved ? 'waiting' : r.outcome === 'applied' ? 'applied' : 'dismissed';
                return (
                  <React.Fragment key={r.id}>
                    {i > 0 && <Divider />}
                    <Row style={styles.row} gap={space.sm}>
                      <Ionicons
                        name={state === 'applied' ? 'checkmark-circle' : state === 'dismissed' ? 'close-circle' : 'time-outline'}
                        size={20}
                        color={state === 'applied' ? colors.success : state === 'dismissed' ? colors.grayLight : colors.warning}
                      />
                      <View style={{ flex: 1 }}>
                        <Txt v="captionStrong" numberOfLines={1}>
                          {r.products ? `${r.products.brand} ${r.products.name}`.trim() : r.product_id}
                        </Txt>
                        <Txt v="caption" color={colors.gray} numberOfLines={1}>
                          {r.store_id ? getStore(r.store_id).name : ''}{r.price != null ? ` · ${Number(r.price).toFixed(2)} ₼` : ''} · {t(`prod.reason_${r.reason}` as never)} · {when(r.created_at)}
                        </Txt>
                      </View>
                      {state === 'applied' && r.points > 0 ? <Pill tone="success" text={`+${r.points}`} /> : <Pill tone={state === 'applied' ? 'success' : state === 'dismissed' ? 'neutral' : 'warning'} text={t(`contrib.${state}` as never)} />}
                    </Row>
                  </React.Fragment>
                );
              })}
            </Card>
          </>
        )}

        {loaded && !empty && (
          <Btn title={t('home.scanBarcode')} icon="barcode-outline" variant="secondary" onPress={() => router.push('/scan')} style={{ marginTop: space.xl }} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, paddingHorizontal: space.sm, borderRadius: radius.md },
});
