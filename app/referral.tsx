import React, { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Card, Divider, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { useRefresh } from '@/lib/useRefresh';
import { useAuth } from '@/store/auth';
import { SITE_URL } from '@/lib/links';

interface Ledger { delta: number; reason: string; created_at: string }
interface PointsSettings { referral: number; trip: number; plus_cost: number; plus_days: number }
const REASON: Record<string, string> = { referral_received: 'Dəvət kodu ilə qoşuldun', referral_sent: 'Dostun qoşuldu', trip: 'Alış-veriş səfəri', plus_redeem: 'Plus günlərinə çevrildi' };

/** Points & referral: my code, share, enter a friend's code, convert points into Plus days. */
export default function Referral() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [friend, setFriend] = useState('');
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [cfg, setCfg] = useState<PointsSettings>({ referral: 100, trip: 10, plus_cost: 300, plus_days: 7 });
  const [busy, setBusy] = useState<string | null>(null);
  const points = auth.profile?.points ?? 0;

  const load = useCallback(async () => {
    if (!supabase || !auth.user) return;
    const [{ data: c }, { data: l }, { data: s }] = await Promise.all([
      supabase.rpc('my_referral_code'),
      supabase.from('points_ledger').select('delta, reason, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('app_settings').select('value').eq('key', 'points').maybeSingle(),
    ]);
    if (typeof c === 'string') setCode(c);
    setLedger((l ?? []) as Ledger[]);
    if (s?.value) setCfg({ ...cfg, ...(s.value as Partial<PointsSettings>) });
    await auth.refreshProfile();
  }, [auth.user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  const refresh = useRefresh(load);

  const share = async () => {
    if (!code) return;
    const message = `Cheap Market ilə səbətinin ən ucuz olduğu marketi tap 🧺 Dəvət kodum: ${code} — qeydiyyatdan sonra "Dəvət kodu" bölməsinə yaz, ikimiz də ${cfg.referral} xal qazanaq. ${SITE_URL}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        notify('Kopyalandı', 'Dəvət mətni panoya kopyalandı.');
      } else await Share.share({ message });
    } catch {
      /* dismissed */
    }
  };
  const apply = async () => {
    if (!supabase || friend.trim().length < 4) return;
    setBusy('apply');
    const { data, error } = await supabase.rpc('apply_referral', { p_code: friend.trim() });
    setBusy(null);
    if (error) return notify('Kod qəbul olunmadı', error.message.replace(/^.*?: /, ''));
    setFriend('');
    notify('Təbriklər 🎉', `${(data as { points: number }).points} xal qazandın.`);
    load();
  };
  const redeem = async () => {
    if (!supabase) return;
    setBusy('redeem');
    const { data, error } = await supabase.rpc('redeem_points_for_plus');
    setBusy(null);
    if (error) return notify('Olmadı', error.message.replace(/^.*?: /, ''));
    const r = data as { days: number; expires_at: string };
    notify('Plus aktivdir ⭐', `${r.days} gün Plus əlavə olundu. Bitmə: ${new Date(r.expires_at).toLocaleDateString('az-AZ')}`);
    load();
  };

  if (!auth.user)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Xal və dəvət" />
        <View style={{ padding: space.lg }}>
          <Btn title="Daxil ol" onPress={() => router.push('/auth')} />
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Xal və dəvət" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} refreshControl={refresh.control} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Txt v="caption" color="rgba(255,255,255,0.8)">
            Xal balansın
          </Txt>
          <Txt v="display" color={colors.white} style={{ marginTop: 4 }}>
            {points} xal
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>
            {cfg.plus_cost} xal = {cfg.plus_days} gün Plus · hər alış-veriş səfəri +{cfg.trip} · hər dəvət +{cfg.referral}
          </Txt>
          <Btn title={`${cfg.plus_cost} xalı ${cfg.plus_days} gün Plus-a çevir`} variant="secondary" size="md" loading={busy === 'redeem'} disabled={points < cfg.plus_cost} onPress={redeem} style={{ marginTop: space.md }} />
        </View>

        <Card style={{ marginTop: space.lg }}>
          <Txt v="bodyStrong">Dəvət kodun</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
            Dostun qeydiyyatdan sonra bu kodu yazsın: ikiniz də {cfg.referral} xal alırsınız.
          </Txt>
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <View style={styles.codeBox}>
              <Txt style={{ fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: 4, color: colors.dark }}>{code ?? '……'}</Txt>
            </View>
            <Pressable onPress={share} accessibilityRole="button" style={styles.shareBtn}>
              <Ionicons name="share-social" size={20} color={colors.white} />
              <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6 }}>
                Paylaş
              </Txt>
            </Pressable>
          </Row>
        </Card>

        <Card style={{ marginTop: space.md }}>
          <Txt v="bodyStrong">Dostunun kodu var?</Txt>
          <Row gap={space.sm} style={{ marginTop: space.md }}>
            <TextInput value={friend} onChangeText={(t) => setFriend(t.toUpperCase())} placeholder="DƏVƏT KODU" placeholderTextColor={colors.grayLight} autoCapitalize="characters" autoCorrect={false} style={styles.input} returnKeyType="done" onSubmitEditing={apply} />
            <Btn title="Tətbiq et" size="md" full={false} loading={busy === 'apply'} disabled={friend.trim().length < 4} onPress={apply} />
          </Row>
        </Card>

        {ledger.length > 0 && (
          <>
            <Txt v="bodyStrong" style={{ marginTop: space.xl, marginBottom: space.sm }}>
              Xal tarixçəsi
            </Txt>
            <Card style={{ paddingVertical: space.xs }}>
              {ledger.map((l, i) => (
                <React.Fragment key={`${l.created_at}-${i}`}>
                  {i > 0 && <Divider />}
                  <Row style={{ paddingVertical: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Txt v="body" style={{ fontSize: 14 }}>
                        {REASON[l.reason] ?? l.reason}
                      </Txt>
                      <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                        {new Date(l.created_at).toLocaleDateString('az-AZ')}
                      </Txt>
                    </View>
                    <Txt v="bodyStrong" color={l.delta >= 0 ? colors.success : colors.primary}>
                      {l.delta >= 0 ? '+' : ''}
                      {l.delta}
                    </Txt>
                  </Row>
                </React.Fragment>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: space.xl },
  codeBox: { flex: 1, backgroundColor: colors.fill, borderRadius: radius.md, height: 52, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.fill, borderRadius: radius.md, paddingHorizontal: 14, height: 48, fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 2, color: colors.dark },
});
