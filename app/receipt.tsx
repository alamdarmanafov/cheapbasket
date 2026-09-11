import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, space } from '@/theme';
import { Btn, Card, Chip, Divider, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { API_URL } from '@/lib/plusStore';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/track';
import { useAuth } from '@/store/auth';
import { useCatalog } from '@/store/catalog';

interface Line { product_id: string | null; product_name: string | null; name: string; price: number; qty: number; keep: boolean }
interface Read { store_id: string | null; store_name: string | null; total: number | null; items: Omit<Line, 'keep'>[]; remaining: number }

/**
 * The till receipt as a price source.
 *
 * Photograph it after shopping; the server reads the lines and pairs them
 * with the catalogue; the shopper unticks what is wrong and sends. The admin
 * approves, the prices land for that store, the shopper is paid in points.
 * For every store nobody scrapes, this is where the prices come from.
 */
export default function Receipt() {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const cat = useCatalog();
  const { store: storeParam } = useLocalSearchParams<{ store?: string }>();
  const [phase, setPhase] = useState<'pick' | 'reading' | 'review' | 'sending'>('pick');
  const [storeId, setStoreId] = useState<string>(storeParam ?? '');
  const [total, setTotal] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);

  const token = async () => (await supabase?.auth.getSession())?.data.session?.access_token ?? null;

  const pick = async (fromCamera: boolean) => {
    if (!auth.user) {
      router.push('/auth');
      return;
    }
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify(t('receipt.title'), t('receipt.noPermission'));
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.55, base64: true, allowsEditing: false };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]?.base64) return;
    const image = res.assets[0].base64;
    if (image.length > 4_000_000) return notify(t('receipt.title'), t('receipt.tooBig'));
    setPhase('reading');
    try {
      const r = await fetch(`${API_URL}/api/receipt`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ image }) });
      const j = (await r.json()) as Read & { error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      if (!j.items.length) {
        setPhase('pick');
        return notify(t('receipt.title'), t('receipt.nothingRead'));
      }
      setStoreId((s) => s || j.store_id || '');
      setTotal(j.total);
      setLines(j.items.map((it) => ({ ...it, keep: !!it.product_id })));
      setPhase('review');
      track('receipt', { step: 'read', items: j.items.length, matched: j.items.filter((it) => it.product_id).length });
    } catch (e) {
      setPhase('pick');
      notify(t('common.error'), (e as Error).message);
    }
  };

  const send = async () => {
    const kept = lines.filter((l) => l.keep);
    if (!kept.length) return notify(t('receipt.title'), t('receipt.pickOne'));
    setPhase('sending');
    try {
      const r = await fetch(`${API_URL}/api/receipt`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ store_id: storeId || null, total, items: kept.map(({ keep: _k, product_name: _n, ...it }) => it) }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      track('receipt', { step: 'sent', items: kept.length, store_id: storeId || null });
      notify(t('receipt.sentTitle'), t('receipt.sentBody'));
      router.back();
    } catch (e) {
      setPhase('review');
      notify(t('common.error'), (e as Error).message);
    }
  };

  const matched = lines.filter((l) => l.product_id).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('receipt.title')} />
      {phase === 'pick' || phase === 'reading' ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.lg }}>
          <StateView emoji="🧾" title={t('receipt.introTitle')} body={t('receipt.introBody')} />
          <Btn title={t('receipt.takePhoto')} icon="camera" loading={phase === 'reading'} onPress={() => pick(true)} />
          <Btn title={t('receipt.fromGallery')} variant="ghost" size="md" disabled={phase === 'reading'} onPress={() => pick(false)} style={{ marginTop: space.sm }} />
          {phase === 'reading' && (
            <Txt v="caption" color={colors.gray} center style={{ marginTop: space.md }}>
              {t('receipt.reading')}
            </Txt>
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120 }}>
            <Txt v="captionStrong" color={colors.gray}>
              {t('receipt.whichStore')}
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: space.sm }}>
              {cat.stores.map((s) => (
                <Chip key={s.id} text={s.name} active={storeId === s.id} onPress={() => setStoreId(s.id)} />
              ))}
            </ScrollView>

            <Txt v="caption" color={colors.gray} style={{ marginTop: space.sm }}>
              {t('receipt.reviewHint', { matched, total: lines.length })}
            </Txt>
            <Card style={{ marginTop: space.sm, paddingVertical: space.xs }}>
              {lines.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <Divider />}
                  <Pressable
                    onPress={() => setLines((prev) => prev.map((x, k) => (k === i ? { ...x, keep: !x.keep } : x)))}
                    disabled={!l.product_id}
                    style={[styles.row, !l.product_id && { opacity: 0.5 }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: l.keep }}
                  >
                    <Ionicons name={l.keep ? 'checkbox' : 'square-outline'} size={22} color={l.keep ? colors.primary : colors.grayLight} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Txt v="captionStrong" numberOfLines={1} style={{ fontSize: 13 }}>
                        {l.product_name ?? l.name}
                      </Txt>
                      <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ fontSize: 11 }}>
                        {l.product_id ? t('receipt.onReceipt', { name: l.name }) : t('receipt.unmatched')}
                      </Txt>
                    </View>
                    <Txt v="bodyStrong" num>
                      {l.price.toFixed(2)} ₼{l.qty > 1 ? ` ×${l.qty}` : ''}
                    </Txt>
                  </Pressable>
                </React.Fragment>
              ))}
            </Card>
            {storeId ? (
              <Row gap={8} style={{ marginTop: space.md }}>
                <StoreAvatar store={cat.stores.find((s) => s.id === storeId) ?? { id: storeId, name: storeId, color: colors.gray, initial: '?' }} size={22} />
                <Txt v="caption" color={colors.gray}>
                  {t('receipt.willUpdate', { store: cat.stores.find((s) => s.id === storeId)?.name ?? storeId })}
                </Txt>
              </Row>
            ) : null}
          </ScrollView>
          <View style={[styles.sticky, { paddingBottom: insets.bottom + space.md }]}>
            <Btn title={t('receipt.send')} icon="send" loading={phase === 'sending'} disabled={!storeId} onPress={send} />
            <Btn title={t('receipt.retake')} variant="ghost" size="md" onPress={() => setPhase('pick')} style={{ marginTop: space.xs }} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, paddingHorizontal: space.lg, paddingTop: space.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
});
