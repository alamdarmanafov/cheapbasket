import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Card, Divider, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useT } from '@/lib/i18n';
import { ago } from '@/lib/format';
import { StateView } from '@/components/states';
import { ProductArt, StoreAvatar } from '@/components/product';
import { PlusTag } from '@/components/PlusLock';
import { getProduct, getStore } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { registerForPush, unregisterPush } from '@/lib/notifications';
import { useRefresh } from '@/lib/useRefresh';
import { useAuth } from '@/store/auth';
import { useBasket } from '@/store/basket';

interface Drop { product_id: string; store_id: string; new_price: number; old_price: number; drop_percent: number; changed_at: string; name: string; brand: string; store_name: string }

/** Bell in the top bar: push settings + the latest price drops as an in-app feed. */
export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const { isPlus, lines } = useBasket();
  const t = useT();
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drops, setDrops] = useState<Drop[] | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('price_drops').select('*').order('changed_at', { ascending: false }).limit(30);
    setDrops((data ?? []) as Drop[]);
  }, []);
  useEffect(() => {
    load();
    if (supabase && auth.user) supabase.from('push_tokens').select('token').eq('user_id', auth.user.id).limit(1).then(({ data }) => setPush(!!data?.length));
  }, [load, auth.user]);
  const refresh = useRefresh(load);

  const togglePush = async (v: boolean) => {
    setBusy(true);
    if (v) {
      const r = await registerForPush(auth.user?.id ?? null);
      if (r.status === 'granted') setPush(true);
      else if (r.status === 'unsupported') notify(t('notif.title'), t('notif.webOnly'));
      else notify(t('notif.title'), t('notif.denied'));
    } else {
      await unregisterPush(auth.user?.id ?? null);
      setPush(false);
    }
    setBusy(false);
  };

  const inBasket = new Set(lines.map((l) => l.product.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('notif.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} refreshControl={refresh.control}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: space.md }}>
              <Txt v="bodyStrong">Push bildirişlər</Txt>
              <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
                AI endirim xəbəri və səbətindəki qiymət düşüşləri{isPlus ? t('notif.everyDay') : t('notif.plusFeature')}
              </Txt>
            </View>
            <Switch value={push} disabled={busy} onValueChange={togglePush} trackColor={{ true: colors.primary, false: colors.line }} thumbColor={colors.white} />
          </Row>
          <View style={{ marginVertical: space.md }}>
            <Divider />
          </View>
          <Pressable onPress={() => router.push(auth.user ? '/account' : '/auth')} style={styles.row}>
            <Ionicons name="mail-unread-outline" size={20} color={colors.dark} />
            <Txt v="body" style={{ flex: 1, marginLeft: 12, fontSize: 14 }}>
              Endirim xəbəri tənzimləmələri
            </Txt>
            <Ionicons name="chevron-forward" size={18} color={colors.grayLight} />
          </Pressable>
          <Pressable onPress={() => router.push(isPlus ? '/deals' : '/plus')} style={styles.row}>
            <Ionicons name="trending-down-outline" size={20} color={colors.dark} />
            <Txt v="body" style={{ flex: 1, marginLeft: 12, fontSize: 14 }}>
              Səbətimdəki məhsullar ucuzlaşanda xəbər ver
            </Txt>
            {!isPlus && <PlusTag />}
            <Ionicons name="chevron-forward" size={18} color={colors.grayLight} style={{ marginLeft: 6 }} />
          </Pressable>
        </Card>

        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          Son qiymət düşüşləri
        </Txt>
        {drops == null ? (
          <Txt v="caption" color={colors.gray}>
            Yüklənir…
          </Txt>
        ) : drops.length === 0 ? (
          <StateView emoji="🔕" title={t('notif.none')} body={t('notif.noneBody')} />
        ) : (
          <Card style={{ paddingVertical: space.xs }}>
            {drops.map((d, i) => {
              const p = getProduct(d.product_id);
              return (
                <React.Fragment key={`${d.product_id}-${d.store_id}-${d.changed_at}`}>
                  {i > 0 && <Divider />}
                  <Pressable onPress={() => router.push(`/product/${d.product_id}`)} style={({ pressed }) => [{ paddingVertical: space.md }, pressed && { opacity: 0.7 }]}>
                    <Row gap={space.md}>
                      {p ? <ProductArt product={p} size={40} emojiScale={0.6} /> : <View style={{ width: 40 }} />}
                      <View style={{ flex: 1 }}>
                        <Row gap={6}>
                          <Txt v="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {d.brand} {d.name}
                          </Txt>
                          {inBasket.has(d.product_id) && <Pill tone="success" text={t('notif.inBasket')} />}
                        </Row>
                        <Row gap={6} style={{ marginTop: 2 }}>
                          <StoreAvatar store={getStore(d.store_id)} size={14} />
                          <Txt v="caption" color={colors.gray}>
                            {d.store_name} · {Number(d.old_price).toFixed(2)} → {Number(d.new_price).toFixed(2)} ₼ · {ago(d.changed_at)}
                          </Txt>
                        </Row>
                      </View>
                      <Pill tone="primary" text={`−${Math.round(Number(d.drop_percent))}%`} />
                    </Row>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm },
});
