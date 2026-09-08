import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Card, Divider, Pill, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StateView } from '@/components/states';
import { PlusTag } from '@/components/PlusLock';
import { getProduct } from '@/data/products';
import { optimize } from '@/lib/optimizer';
import { supabase } from '@/lib/supabase';
import { confirmAsync, notify } from '@/lib/confirm';
import { useRefresh } from '@/lib/useRefresh';
import { useAuth } from '@/store/auth';
import { useT } from '@/lib/i18n';
import { useBasket } from '@/store/basket';

interface Saved { id: string; name: string; items: Array<{ id: string; qty: number }>; updated_at: string }
const FREE_LIMIT = 1;

/** {t('lists.title')}: save the current basket under a name and load it back later. Free: 1 list, Plus: unlimited. */
export default function Lists() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const t = useT();
  const basket = useBasket();
  const [lists, setLists] = useState<Saved[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !auth.user) return;
    const { data } = await supabase.from('saved_baskets').select('id, name, items, updated_at').order('updated_at', { ascending: false });
    setLists((data ?? []) as Saved[]);
  }, [auth.user]);
  useEffect(() => {
    load();
  }, [load]);
  const refresh = useRefresh(load);

  const save = async () => {
    if (!supabase || !auth.user) return;
    if (!basket.entries.length) return notify(t('lists.emptyBasket'), t('lists.emptyBody'));
    if (!basket.isPlus && (lists?.length ?? 0) >= FREE_LIMIT) {
      const go = await confirmAsync(t('lists.plusNeeded'), t('lists.plusBody', { limit: FREE_LIMIT }), 'Plus-a bax');
      if (go) router.push('/plus');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('saved_baskets').insert({ user_id: auth.user.id, name: name.trim() || t('lists.defaultName', { n: (lists?.length ?? 0) + 1 }), items: basket.entries });
    setBusy(false);
    if (error) return notify(t('lists.notSaved'), error.message);
    setName('');
    load();
  };
  const loadInto = async (l: Saved) => {
    if (basket.entries.length && !(await confirmAsync(t('lists.replace'), t('lists.replaceBody', { name: l.name }), t('lists.replaceCta')))) return;
    basket.replace(l.items.filter((i) => getProduct(i.id)));
    router.replace('/basket');
  };
  const remove = async (l: Saved) => {
    if (!supabase || !(await confirmAsync(t('lists.delete'), `"${l.name}" silinsin?`, 'Sil', true))) return;
    await supabase.from('saved_baskets').delete().eq('id', l.id);
    load();
  };
  const totalOf = (l: Saved) => {
    const lines = l.items.map((i) => ({ product: getProduct(i.id), qty: i.qty })).filter((x): x is { product: NonNullable<ReturnType<typeof getProduct>>; qty: number } => !!x.product);
    const o = optimize(lines);
    return o.best ? `${o.best.total.toFixed(2)} ₼ · ${o.best.store.name}` : '';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('lists.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} refreshControl={refresh.control} keyboardShouldPersistTaps="handled">
        <Card>
          <Row gap={6}>
            <Txt v="bodyStrong">{t('lists.saveCurrent')}</Txt>
            {!basket.isPlus && <PlusTag />}
          </Row>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
            {basket.count} məhsul · {basket.isPlus ? t('lists.unlimited') : t('lists.freeLimit', { limit: FREE_LIMIT })}
          </Txt>
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <TextInput value={name} onChangeText={setName} placeholder={t('lists.namePlaceholder')} placeholderTextColor={colors.grayLight} style={styles.input} returnKeyType="done" onSubmitEditing={save} />
            <Btn title="Saxla" size="md" full={false} icon="bookmark" loading={busy} onPress={save} />
          </Row>
        </Card>

        <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
          Yadda saxlanan siyahılar
        </Txt>
        {lists == null ? (
          <Txt v="caption" color={colors.gray}>
            Yüklənir…
          </Txt>
        ) : lists.length === 0 ? (
          <StateView emoji="📋" title={t('lists.none')} body={t('lists.noneBody', { name: t('lists.namePlaceholder') })} />
        ) : (
          <Card style={{ paddingVertical: space.xs }}>
            {lists.map((l, i) => (
              <React.Fragment key={l.id}>
                {i > 0 && <Divider />}
                <Row style={{ paddingVertical: space.md }} gap={space.md}>
                  <View style={styles.icon}>
                    <Ionicons name="list" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={1}>
                      {l.name}
                    </Txt>
                    <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                      {l.items.length} məhsul{totalOf(l) ? ` · ${totalOf(l)}` : ''} · {new Date(l.updated_at).toLocaleDateString('az-AZ')}
                    </Txt>
                  </View>
                  <Pressable onPress={() => loadInto(l)} accessibilityRole="button" style={styles.loadBtn}>
                    <Txt v="captionStrong" color={colors.white}>
                      Səbətə yüklə
                    </Txt>
                  </Pressable>
                  <Pressable onPress={() => remove(l)} hitSlop={8} accessibilityLabel="Sil" accessibilityRole="button">
                    <Ionicons name="trash-outline" size={20} color={colors.grayLight} />
                  </Pressable>
                </Row>
              </React.Fragment>
            ))}
          </Card>
        )}
        {!basket.isPlus && lists && lists.length >= FREE_LIMIT && (
          <Row gap={8} style={{ marginTop: space.md, alignItems: 'center' }}>
            <Pill tone="primary" text="PLUS" />
            <Txt v="caption" color={colors.gray} style={{ flex: 1 }}>
              Limitsiz siyahı üçün Plus-a keç.
            </Txt>
          </Row>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, backgroundColor: colors.fill, borderRadius: radius.md, paddingHorizontal: 14, height: 44, fontFamily: fonts.regular, fontSize: 15, color: colors.dark },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  loadBtn: { backgroundColor: colors.dark, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
});
