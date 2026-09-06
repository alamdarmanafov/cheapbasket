import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Divider, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/store/auth';

type Mode = 'signin' | 'signup' | 'reset';

/** Which social providers are configured in Supabase. Set EXPO_PUBLIC_AUTH_PROVIDERS=google,apple once Apple is set up. */
const PROVIDERS = (process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? 'google,apple').split(',').map((s: string) => s.trim());
const SHOW_APPLE = PROVIDERS.includes('apple');
const SHOW_GOOGLE = PROVIDERS.includes('google');

/** Sign in / sign up: email + password, Apple, Google. Guests can keep using the app. */
export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const run = async (key: string, fn: () => Promise<{ error?: string; needsConfirm?: boolean }>) => {
    setBusy(key);
    setError(null);
    setInfo(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setError(translate(r.error));
    else if (r.needsConfirm) setInfo('E-poçtuna təsdiq linki göndərdik. Linkə klikləyib girişi tamamla.');
    else if (mode === 'reset') setInfo('Şifrə sıfırlama linki e-poçtuna göndərildi.');
    else done();
  };

  const submit = () => {
    if (!email.trim()) return setError('E-poçt ünvanını yaz.');
    if (mode === 'reset') return run('email', () => auth.resetPassword(email.trim()));
    if (password.length < 6) return setError('Şifrə ən azı 6 simvol olmalıdır.');
    if (mode === 'signup') return run('email', () => auth.signUpEmail(email.trim(), password, name.trim()));
    return run('email', () => auth.signInEmail(email.trim(), password));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader closeIcon />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: space.sm }}>
          <LogoMark size={56} />
          <Txt v="title" center style={{ marginTop: space.md }}>
            {mode === 'signup' ? 'Hesab yarat' : mode === 'reset' ? 'Şifrəni sıfırla' : 'Xoş gəldin'}
          </Txt>
          <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
            {mode === 'signup' ? 'Səbətin və qənaətin bütün cihazlarında sinxron olsun.' : mode === 'reset' ? 'E-poçtuna sıfırlama linki göndərək.' : 'Səbətini, Plus-ı və bildirişləri saxlamaq üçün daxil ol.'}
          </Txt>
        </View>

        {!auth.enabled && (
          <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
            <Txt v="caption" color={colors.warning}>
              Demo rejim: Supabase konfiqurasiya olunmayıb, giriş işləmir.
            </Txt>
          </View>
        )}

        {mode !== 'reset' && (
          <>
            {SHOW_APPLE && (
              <Btn title="Apple ilə davam et" variant="dark" icon="logo-apple" loading={busy === 'apple'} onPress={() => run('apple', auth.signInApple)} style={{ marginTop: space.xl }} />
            )}
            {SHOW_GOOGLE && (
              <Btn title="Google ilə davam et" variant="secondary" icon="logo-google" loading={busy === 'google'} onPress={() => run('google', auth.signInGoogle)} style={{ marginTop: SHOW_APPLE ? space.sm : space.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }} />
            )}
            {(SHOW_APPLE || SHOW_GOOGLE) && (
            <Row gap={space.md} style={{ marginVertical: space.lg }}>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
              <Txt v="caption" color={colors.gray}>
                və ya e-poçt ilə
              </Txt>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
            </Row>
            )}
          </>
        )}

        {mode === 'signup' && <Field icon="person-outline" placeholder="Ad" value={name} onChangeText={setName} autoCapitalize="words" />}
        <Field icon="mail-outline" placeholder="E-poçt" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {mode !== 'reset' && (
          <Field icon="lock-closed-outline" placeholder="Şifrə" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'password'} />
        )}

        {error && (
          <View style={[styles.note, { backgroundColor: colors.primarySoft }]}>
            <Txt v="caption" color={colors.primary}>
              {error}
            </Txt>
          </View>
        )}
        {info && (
          <View style={[styles.note, { backgroundColor: colors.successSoft }]}>
            <Txt v="caption" color={colors.success}>
              {info}
            </Txt>
          </View>
        )}

        <Btn
          title={mode === 'signup' ? 'Qeydiyyatdan keç' : mode === 'reset' ? 'Link göndər' : 'Daxil ol'}
          loading={busy === 'email'}
          onPress={submit}
          style={{ marginTop: space.md }}
        />

        {mode === 'signin' && (
          <Pressable onPress={() => setMode('reset')} style={{ alignSelf: 'center', marginTop: space.md }} hitSlop={8}>
            <Txt v="captionStrong" color={colors.gray}>
              Şifrəni unutmusan?
            </Txt>
          </Pressable>
        )}

        <Row gap={6} style={{ justifyContent: 'center', marginTop: space.xl }}>
          <Txt v="caption" color={colors.gray}>
            {mode === 'signup' ? 'Hesabın var?' : 'Hesabın yoxdur?'}
          </Txt>
          <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} hitSlop={8}>
            <Txt v="captionStrong" color={colors.primary}>
              {mode === 'signup' ? 'Daxil ol' : 'Qeydiyyatdan keç'}
            </Txt>
          </Pressable>
        </Row>

        <Pressable onPress={done} style={{ alignSelf: 'center', marginTop: space.lg }} hitSlop={8}>
          <Txt v="caption" color={colors.grayLight}>
            Qonaq kimi davam et
          </Txt>
        </Pressable>

        <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.xl, fontSize: 11 }}>
          Davam etməklə İstifadə şərtləri və Məxfilik siyasəti ilə razılaşırsan.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, ...rest }: { icon: keyof typeof Ionicons.glyphMap } & React.ComponentProps<typeof TextInput>) {
  return (
    <Row style={styles.field} gap={space.sm}>
      <Ionicons name={icon} size={20} color={colors.gray} />
      <TextInput {...rest} placeholderTextColor={colors.grayLight} style={styles.input} />
    </Row>
  );
}

function translate(m: string): string {
  const l = m.toLowerCase();
  if (l.includes('invalid login credentials')) return 'E-poçt və ya şifrə yanlışdır.';
  if (l.includes('already registered') || l.includes('already exists')) return 'Bu e-poçt artıq qeydiyyatdadır. Daxil ol.';
  if (l.includes('email not confirmed')) return 'E-poçtunu təsdiqlə: gələn linkə klik et.';
  if (l.includes('password should be')) return 'Şifrə ən azı 6 simvol olmalıdır.';
  if (l.includes('rate limit')) return 'Çox cəhd. Bir az sonra yenidən yoxla.';
  if (l.includes('provider is not enabled') || l.includes('unsupported provider')) return 'Bu giriş üsulu hələ aktiv edilməyib (Supabase → Auth → Providers).';
  return m;
}

const styles = StyleSheet.create({
  field: { height: 52, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, marginTop: space.sm },
  input: { flex: 1, fontSize: 15, color: colors.dark, height: 50, fontFamily: fonts.regular, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  note: { padding: space.md, borderRadius: radius.md, marginTop: space.md },
});
