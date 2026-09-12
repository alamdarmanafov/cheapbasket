import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Row, Txt } from './ui';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { track } from '@/lib/track';
import { useAuth } from '@/store/auth';

/**
 * "We do not list this — tell us." The same box behind the scanner's not-found
 * sheet and the search screen's empty result: with a barcode from the one,
 * with only a name from the other. Approval in the admin panel pays the
 * suggester points, so the reward is named on the button.
 */
export function SuggestProduct({ barcode, initialName = '', storeId, title, body, onDone, onFocus }: { barcode?: string; initialName?: string; storeId?: string | null; title: string; body?: string; onDone?: () => void; onFocus?: () => void }) {
  const t = useT();
  const router = useRouter();
  const auth = useAuth();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState(10);

  useEffect(() => setName(initialName), [initialName]);

  // What a suggestion is worth is an admin setting, not a constant in the app.
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'points')
      .maybeSingle()
      .then(({ data }) => {
        const v = Number((data?.value as { suggestion?: number } | null)?.suggestion);
        if (Number.isFinite(v) && v > 0) setReward(v);
      });
  }, []);

  const submit = async () => {
    if (!supabase) return;
    if (!auth.user) {
      router.push('/auth');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('suggest_product', { p_barcode: barcode ?? null, p_name: name.trim(), p_store_id: storeId || null });
    setBusy(false);
    if (error) {
      notify(t('common.error'), error.message.replace(/^.*?: /, ''));
      return;
    }
    const status = (data as { status?: string } | null)?.status;
    track('suggest', { barcode: barcode ?? null, name: name.trim(), status: status ?? 'unknown', store_id: storeId ?? null });
    if (status === 'exists') notify(t('scan.notFound'), t('scan.suggestExists'));
    else if (status === 'pending') notify(t('scan.suggestThanks'), t('scan.suggestPending'));
    else notify(t('scan.suggestThanks'), t('scan.suggestThanksBody', { points: reward }));
    onDone?.();
  };

  return (
    <View style={styles.box}>
      <Row gap={space.sm}>
        <Ionicons name="add-circle" size={20} color={colors.primary} />
        <Txt v="bodyStrong" style={{ flex: 1 }}>
          {title}
        </Txt>
        {!!barcode && (
          <Txt v="caption" color={colors.gray} style={{ fontFamily: fonts.semibold }}>
            {barcode}
          </Txt>
        )}
      </Row>
      <Txt v="caption" color={colors.gray} style={{ marginTop: 4 }}>
        {body ?? t('scan.suggestBody', { points: reward })}
      </Txt>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('scan.suggestName')}
        placeholderTextColor={colors.grayLight}
        returnKeyType="send"
        onSubmitEditing={submit}
        onFocus={onFocus}
        style={styles.input}
        maxLength={120}
      />
      <Btn
        title={auth.user ? t('scan.suggestSend', { points: reward }) : t('scan.suggestSignIn')}
        size="md"
        loading={busy}
        disabled={!!auth.user && name.trim().length < 2}
        onPress={submit}
        style={{ marginTop: space.sm }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: space.md, backgroundColor: colors.fill, borderRadius: radius.lg, padding: space.md },
  input: {
    marginTop: space.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.dark,
  },
});
