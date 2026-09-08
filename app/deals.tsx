import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, space } from '@/theme';
import { Card, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { ProductArt, StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useT } from '@/lib/i18n';
import { ago } from '@/lib/format';
import { StateView } from '@/components/states';
import { getProduct, getStore } from '@/data/products';
import { supabase } from '@/lib/supabase';
import { useBasket } from '@/store/basket';
import { useAuth } from '@/store/auth';
import { useRefresh } from '@/lib/useRefresh';

interface Drop { product_id: string; store_id: string; new_price: number; old_price: number; drop_amount: number; drop_percent: number; changed_at: string; name: string; brand: string; size: string; emoji: string | null; store_name: string }

/** {t('deals.title')}: recent price drops, basket items first. Push notifications deep-link here. */
export default function Deals() {
  const router = useRouter();
  const { lines, isPlus } = useBasket();
  const t = useT();
  const auth = useAuth();
  const [drops, setDrops] = useState<Drop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('price_drops').select('*').order('changed_at', { ascending: false }).limit(100);
    if (error) setError(error.message);
    setDrops((data ?? []) as Drop[]);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const refresh = useRefresh(load);

  const inBasket = new Set(lines.map((l) => l.product.id));
  const mine = (drops ?? []).filter((d) => inBasket.has(d.product_id));
  const others = (drops ?? []).filter((d) => !inBasket.has(d.product_id));

  const Section = ({ title, items }: { title: string; items: Drop[] }) =>
    items.length === 0 ? null : (
      <View style={{ marginTop: space.lg }}>
        <Txt v="bodyStrong" style={{ marginBottom: space.sm }}>
          {title}
        </Txt>
        <Card style={{ paddingVertical: space.xs }}>
          {items.map((d, i) => {
            const p = getProduct(d.product_id);
            return (
              <React.Fragment key={`${d.product_id}-${d.store_id}`}>
                {i > 0 && <Divider />}
                <Row style={{ paddingVertical: space.md }} gap={space.md}>
                  {p ? <ProductArt product={p} size={44} emojiScale={0.6} /> : <View style={{ width: 44 }} />}
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={1}>
                      {d.brand} {d.name}
                    </Txt>
                    <Row gap={6} style={{ marginTop: 2 }}>
                      <StoreAvatar store={getStore(d.store_id)} size={16} />
                      <Txt v="caption" color={colors.gray}>
                        {d.store_name} · {d.size} · {ago(d.changed_at)}
                      </Txt>
                    </Row>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="caption" color={colors.grayLight} style={{ textDecorationLine: 'line-through' }}>
                      {d.old_price.toFixed(2)} ₼
                    </Txt>
                    <Price value={d.new_price} size="sm" color={colors.success} />
                    <Pill tone="success" text={`−${d.drop_percent}%`} />
                  </View>
                </Row>
              </React.Fragment>
            );
          })}
        </Card>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('deals.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} refreshControl={refresh.control}>
        <View style={styles.banner}>
          <Txt style={{ fontSize: 26, lineHeight: 32 }}>🔻</Txt>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Txt v="bodyStrong">AI endirim xəbəri</Txt>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
              {isPlus ? t('deals.plusBody') : t('deals.freeBody')}
              {auth.user ? '' : t('deals.signInHint')}
            </Txt>
          </View>
        </View>
        {error && (
          <Txt v="caption" color={colors.primary} style={{ marginTop: space.md }}>
            {error}
          </Txt>
        )}
        {drops === null ? (
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.lg }}>
            Yüklənir…
          </Txt>
        ) : drops.length === 0 ? (
          <StateView emoji="🏷️" title={t('deals.none')} body={t('deals.noneBody')} cta={t('deals.addProduct')} onCta={() => router.push('/search')} />
        ) : (
          <>
            <Section title={t('deals.inYourBasket')} items={mine} />
            <Section title={t('deals.others')} items={others} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, ...shadow.card },
});
