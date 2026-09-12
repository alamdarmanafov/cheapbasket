import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, space } from '@/theme';
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
export function PriceReportModal({ product, visible, onClose, initialStore, initialReason = 'add' }: { product: Product; visible: boolean; onClose: () => void; initialStore?: string | null; initialReason?: ReportReason }) {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const [store, setStore] = useState<string | null>(initialStore ?? null);
  const [reason, setReason] = useState<ReportReason>(initialReason);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState(2);

  useEffect(() => {
    if (!visible) return;
    setStore(initialStore ?? null);
    setReason(initialReason);
    setPrice('');
  }, [visible, initialStore, initialReason]);

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
