import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Card, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';

/** "Mənim məlumatlarım": name/surname and city are editable (Apple often hides the name), plus account deletion. */
export default function Account() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const meta = auth.user?.user_metadata ?? {};
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setName(auth.profile?.display_name || meta.display_name || meta.full_name || meta.name || '');
    setCity(auth.profile?.city || '');
  }, [auth.profile, auth.user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auth.user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Mənim məlumatlarım" />
        <View style={{ padding: space.lg }}>
          <Btn title="Daxil ol" onPress={() => router.push('/auth')} />
        </View>
      </View>
    );
  }

  const provider = (auth.user.app_metadata?.provider as string) ?? 'email';
  const providerLabel = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'E-poçt';

  const save = async () => {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.from('profiles').upsert({ user_id: auth.user!.id, display_name: name.trim() || null, city: city.trim() || null, updated_at: new Date().toISOString() });
    if (!error) await supabase.auth.updateUser({ data: { display_name: name.trim() } }).catch(() => undefined);
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Yadda saxlanıldı' });
    if (!error) auth.refreshProfile();
  };

  const remove = () => {
    Alert.alert('Hesabı sil', 'Hesabın, səbətin və bütün məlumatların silinəcək. Bu geri qaytarıla bilməz.', [
      { text: 'Ləğv et', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          if (!supabase) return;
          const { error } = await supabase.rpc('delete_own_account');
          if (error) setMsg({ ok: false, text: error.message });
          else {
            await auth.signOut();
            router.replace('/auth');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Mənim məlumatlarım" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Card>
          <Txt v="caption" color={colors.gray}>
            Ad, soyad
          </Txt>
          <TextInput value={name} onChangeText={setName} placeholder="Adın və soyadın" placeholderTextColor={colors.grayLight} style={styles.input} autoCapitalize="words" />
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.md }}>
            Şəhər
          </Txt>
          <TextInput value={city} onChangeText={setCity} placeholder="Bakı" placeholderTextColor={colors.grayLight} style={styles.input} />
          <Txt v="caption" color={colors.gray} style={{ marginTop: space.md }}>
            E-poçt
          </Txt>
          <Row gap={8} style={{ marginTop: 6 }}>
            <Txt v="body">{auth.user.email ?? '—'}</Txt>
            <View style={styles.tag}>
              <Ionicons name={provider === 'apple' ? 'logo-apple' : provider === 'google' ? 'logo-google' : 'mail-outline'} size={12} color={colors.gray} />
              <Txt v="caption" color={colors.gray} style={{ fontSize: 11, marginLeft: 4 }}>
                {providerLabel}
              </Txt>
            </View>
          </Row>
          {provider === 'apple' && auth.user.email?.endsWith('privaterelay.appleid.com') && (
            <Txt v="caption" color={colors.gray} style={{ marginTop: 6, fontSize: 11 }}>
              Apple e-poçtunu gizlədib; bildirişlər bu ünvana yönləndirilir.
            </Txt>
          )}
          {msg && (
            <View style={[styles.note, { backgroundColor: msg.ok ? colors.successSoft : colors.primarySoft }]}>
              <Txt v="caption" color={msg.ok ? colors.success : colors.primary}>
                {msg.text}
              </Txt>
            </View>
          )}
          <Btn title="Yadda saxla" loading={busy} onPress={save} style={{ marginTop: space.lg }} />
        </Card>

        <Card style={{ marginTop: space.lg }}>
          <Txt v="bodyStrong">Hesabı sil</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 4 }}>
            Hesabın, səbətin, abunəliyin və cihaz məlumatların tamamilə silinir.
          </Txt>
          <Btn title="Hesabı sil" variant="secondary" size="md" onPress={remove} style={{ marginTop: space.md }} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, marginTop: 6, fontSize: 15, color: colors.dark, fontFamily: fonts.regular, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.fill, borderRadius: radius.pill, paddingHorizontal: 8, height: 22 },
  note: { padding: space.md, borderRadius: radius.md, marginTop: space.md },
});
