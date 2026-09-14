import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '@/theme';
import { API_URL } from '@/lib/plusStore';
import { Btn, Chip, Row, Txt } from './ui';
import { Product, sortedPrices } from '@/data/products';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/track';
import { useAuth } from '@/store/auth';

export type ReportReason = 'outdated' | 'wrong' | 'missing' | 'add';
const REASONS: ReportReason[] = ['add', 'wrong', 'outdated', 'missing'];

/**
 * "The price here is 2.49." One sheet behind the product page's "wrong or
 * missing price?" link and the scanner's "we have no price at this store".
 *
 * Two of the four reasons carry a price. Those are the ones that fill the
 * catalogue: the admin applies them with one click, and two shoppers naming
 * the same price at the same store apply it between them (0035). Either way
 * the reporter is paid in points, so the sheet says so.
 */
export function PriceReportModal({ product, visible, onClose, initialStore, initialReason = 'add', initialPrice }: { product: Product; visible: boolean; onClose: () => void; initialStore?: string | null; initialReason?: ReportReason; initialPrice?: number | null }) {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const [store, setStore] = useState<string | null>(initialStore ?? null);
  const [reason, setReason] = useState<ReportReason>(initialReason);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [reward, setReward] = useState(2);

  useEffect(() => {
    if (!visible) return;
    setStore(initialStore ?? null);
    setReason(initialReason);
    setPrice(initialPrice != null ? String(initialPrice) : '');
  }, [visible, initialStore, initialReason, initialPrice]);

  /**
   * The shelf tag is right there: a photo of it fills the price field. The
   * number is read server-side (vision, a daily allowance); the report still
   * goes the ordinary way, so a misread is corrected before it is sent.
   */
  const photo = async () => {
    if (!supabase || !API_URL) return;
    if (!auth.user) {
      onClose();
      router.push('/auth');
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return notify(t('prod.tagFail'), t('prod.tagNoCamera'));
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: false });
    if (res.canceled || !res.assets[0]?.base64) return;
    setReading(true);
    try {
      const tokenValue = (await supabase.auth.getSession()).data.session?.access_token ?? '';
      const r = await fetch(`${API_URL}/api/pricetag`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenValue}` }, body: JSON.stringify({ image: res.assets[0].base64 }) });
      const j = (await r.json().catch(() => ({}))) as { price?: number | null; error?: string };
      if (!r.ok || j.price == null) return notify(t('prod.tagFail'), j.error ?? t('prod.tagUnread'));
      setPrice(String(j.price));
      track('pricetag', { product_id: product.id, price: j.price });
    } catch {
      notify(t('prod.tagFail'), t('prod.tagUnread'));
    } finally {
      setReading(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'points')
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data?.value as { price_report?: number } | null)?.price_report);
        if (Number.isFinite(v) && v > 0) setReward(v);
      });
  }, []);

  const withPrice = reason === 'add' || reason === 'wrong';
  const parsed = Number(price.replace(',', '.'));
  const priceOk = Number.isFinite(parsed) && parsed > 0 && parsed < 10000;
  const canSend = !!store && (!withPrice || priceOk);

  const send = async () => {
    if (!supabase || !store) return;
    if (!auth.user) {
      onClose();
      router.push('/auth');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('price_reports').insert({
      user_id: auth.user.id,
      product_id: product.id,
      store_id: store,
      reason,
      price: withPrice ? Math.round(parsed * 100) / 100 : null,
    });
    setBusy(false);
    onClose();
    if (error) return notify(t('common.error'), error.message.replace(/^.*?: /, ''));
    track('price_report', { product_id: product.id, store_id: store, reason, price: withPrice ? parsed : null });
    notify(t('prod.reportThanks'), withPrice ? t('prod.reportThanksPrice', { points: reward }) : t('prod.reportThanksBody'));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={styles.sheet}>
          <Txt v="bodyStrong">{t('prod.reportTitle')}</Txt>
          <Txt v="caption" color={colors.gray} numberOfLines={1} style={{ marginTop: 2 }}>
            {`${product.brand} ${product.name}`.trim()} · {product.size}
          </Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.md }}>
            {t('prod.reportStore')}
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {sortedPrices(product).map((sp) => (
              <Chip key={sp.store.id} text={sp.price == null ? `${sp.store.name} · ?` : sp.store.name} active={store === sp.store.id} onPress={() => setStore(sp.store.id)} />
            ))}
          </Row>
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.md }}>
            {t('prod.reportReason')}
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {REASONS.map((r) => (
              <Chip key={r} text={t(`prod.reason_${r}` as never)} active={reason === r} onPress={() => setReason(r)} />
            ))}
          </Row>
          {withPrice && (
            <>
              <Txt v="caption" color={colors.gray} style={{ marginTop: space.md }}>
                {t('prod.reportPriceLabel')}
              </Txt>
              <Row gap={space.sm} style={{ marginTop: space.sm }}>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="2.49"
                  placeholderTextColor={colors.grayLight}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  style={styles.input}
                  maxLength={8}
                  accessibilityLabel={t('prod.reportPriceLabel')}
                />
                <Txt v="caption" color={colors.gray} style={{ flex: 1 }}>
                  {t('prod.reportPoints', { points: reward })}
                </Txt>
              </Row>
              {Platform.OS !== 'web' && !!API_URL && (
                <Pressable onPress={photo} disabled={reading} style={({ pressed }) => [styles.photoBtn, (pressed || reading) && { opacity: 0.6 }]} accessibilityRole="button" testID="pricetag-photo">
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                  <Txt v="captionStrong" color={colors.primary} style={{ marginLeft: 6, fontSize: 12 }}>
                    {reading ? t('prod.tagReading') : t('prod.tagPhoto')}
                  </Txt>
                </Pressable>
              )}
            </>
          )}
          <Btn title={auth.user ? t('prod.reportSend') : t('scan.suggestSignIn')} size="md" loading={busy} disabled={!!auth.user && !canSend} onPress={send} style={{ marginTop: space.lg }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, paddingBottom: space.xxl },
  photoBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: space.sm, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  input: {
    width: 110,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.dark,
  },
});
