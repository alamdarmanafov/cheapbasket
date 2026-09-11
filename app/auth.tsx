import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Divider, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { LogoMark } from '@/components/Logo';
import { useAuth } from '@/store/auth';
import { useT, type Key } from '@/lib/i18n';
import { SITE_URL } from '@/lib/links';

type Mode = 'signin' | 'signup' | 'reset';

/** Which social providers are configured in Supabase. Set EXPO_PUBLIC_AUTH_PROVIDERS=google,apple once Apple is set up. */
const PROVIDERS = (process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? 'google,apple').split(',').map((s: string) => s.trim());
const SHOW_APPLE = PROVIDERS.includes('apple');
const SHOW_GOOGLE = PROVIDERS.includes('google');

/** Sign in / sign up: email + password, Apple, Google. An account is required. */
export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const t = useT();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(auth.lastError);
  const [info, setInfo] = useState<string | null>(null);

  const done = () => router.replace('/');

  const run = async (key: string, fn: () => Promise<{ error?: string; needsConfirm?: boolean }>) => {
    setBusy(key);
    setError(null);
    setInfo(null);
    const r = await fn();
    setBusy(null);
    if (r.error) {
      const k = errorKey(r.error);
      setError(k ? `${t(k)}\n(${r.error})` : r.error);
    }
    else if (r.needsConfirm) setInfo(t('auth.confirmSent'));
    else if (mode === 'reset') setInfo(t('auth.resetSent'));
    else done();
  };

  const submit = () => {
    if (!email.trim()) return setError(t('auth.needEmail'));
    if (mode === 'reset') return run('email', () => auth.resetPassword(email.trim()));
    if (password.length < 6) return setError(t('auth.shortPassword'));
    if (mode === 'signup') return run('email', () => auth.signUpEmail(email.trim(), password, name.trim()));
    return run('email', () => auth.signInEmail(email.trim(), password));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {auth.session && <ScreenHeader closeIcon />}
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginTop: auth.session ? space.sm : insets.top + space.xxl }}>
          <LogoMark size={56} />
          <Txt v="title" center style={{ marginTop: space.md }}>
            {t(mode === 'signup' ? 'auth.createAccount' : mode === 'reset' ? 'auth.resetTitle' : 'auth.welcome')}
          </Txt>
          <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
            {t(mode === 'signup' ? 'auth.signupBody' : mode === 'reset' ? 'auth.resetBody' : 'auth.welcomeBody')}
          </Txt>
        </View>

        {!auth.enabled && (
          <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
            <Txt v="caption" color={colors.warning}>
              {t('auth.demoNote')}
            </Txt>
          </View>
        )}

        {mode === 'signup' && <Field icon="person-outline" placeholder={t('auth.name')} value={name} onChangeText={setName} autoCapitalize="words" style={{ marginTop: space.xl }} />}
        <Field icon="mail-outline" placeholder={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={mode === 'signup' ? undefined : { marginTop: space.xl }} />
        {mode !== 'reset' && (
          <Field icon="lock-closed-outline" placeholder={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'password'} />
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
          title={t(mode === 'signup' ? 'auth.signUp' : mode === 'reset' ? 'auth.sendLink' : 'profile.signIn')}
          loading={busy === 'email'}
          onPress={submit}
          style={{ marginTop: space.md }}
        />

        {mode === 'signin' && (
          <Pressable onPress={() => setMode('reset')} style={{ alignSelf: 'center', marginTop: space.md }} hitSlop={8}>
            <Txt v="captionStrong" color={colors.gray}>
              {t('auth.forgot')}
            </Txt>
          </Pressable>
        )}

        <Row gap={6} style={{ justifyContent: 'center', marginTop: space.xl }}>
          <Txt v="caption" color={colors.gray}>
            {t(mode === 'signup' ? 'auth.haveAccount' : 'auth.noAccount')}
          </Txt>
          <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} hitSlop={8}>
            <Txt v="captionStrong" color={colors.primary}>
              {t(mode === 'signup' ? 'profile.signIn' : 'auth.signUp')}
            </Txt>
          </Pressable>
        </Row>

        {/* Social sign-in sits under the email form: most people here have an
            account with us already, so the password path leads. */}
        {mode !== 'reset' && (SHOW_APPLE || SHOW_GOOGLE) && (
          <>
            <Row gap={space.md} style={{ marginVertical: space.lg }}>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
              <Txt v="caption" color={colors.gray}>
                {t('auth.or')}
              </Txt>
              <View style={{ flex: 1 }}>
                <Divider />
              </View>
            </Row>
            {SHOW_APPLE && (
              <Btn title={t('auth.apple')} variant="dark" icon="logo-apple" loading={busy === 'apple'} onPress={() => run('apple', auth.signInApple)} />
            )}
            {SHOW_GOOGLE && (
              <Btn title={t('auth.google')} variant="secondary" icon="logo-google" loading={busy === 'google'} onPress={() => run('google', auth.signInGoogle)} style={{ marginTop: SHOW_APPLE ? space.sm : 0, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }} />
            )}
          </>
        )}


        {/* "By continuing you agree to…" used to be plain text with nothing
            to tap. The two documents it names are links now. */}
        <Txt v="caption" color={colors.grayLight} center style={{ marginTop: space.xl, fontSize: 11 }}>
          {t('auth.termsPrefix')}{' '}
          <Txt v="caption" color={colors.gray} style={{ fontSize: 11, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${SITE_URL}/terms`)}>
            {t('auth.termsLink')}
          </Txt>
          {' '}{t('auth.termsAnd')}{' '}
          <Txt v="caption" color={colors.gray} style={{ fontSize: 11, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(`${SITE_URL}/privacy`)}>
            {t('auth.privacyLink')}
          </Txt>
          {' '}{t('auth.termsSuffix')}
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

/** Maps a Supabase error to a translation key; null when we have no better wording. */
function errorKey(m: string): Key | null {
  const l = m.toLowerCase();
  if (l.includes('invalid login credentials')) return 'auth.errBadCredentials';
  if (l.includes('already registered') || l.includes('already exists')) return 'auth.errAlreadyRegistered';
  if (l.includes('email not confirmed')) return 'auth.errNotConfirmed';
  if (l.includes('password should be')) return 'auth.shortPassword';
  if (l.includes('rate limit')) return 'auth.errRateLimit';
  if (l.includes('provider is not enabled') || l.includes('unsupported provider')) return 'auth.errProviderOff';
  if (l.includes('signups not allowed') || l.includes('signup is disabled')) return 'auth.errSignupsOff';
  if (l.includes('database error saving new user')) return 'auth.errProfile';
  if (l.includes('redirect_uri_mismatch')) return 'auth.errRedirect';
  if (l.includes('invalid_client')) return 'auth.errAppleConfig';
  if (l.includes('bad_oauth_state') || l.includes('flow state')) return 'auth.errFlowState';
  if (l.includes('requested path is invalid') || l.includes('redirect')) return 'auth.errRedirect';
  if (l.includes('invalid email')) return 'auth.errInvalidEmail';
  if (l.includes('blocked')) return 'auth.errBlocked';
  return null;
}

const styles = StyleSheet.create({
  field: { height: 52, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.md, marginTop: space.sm },
  input: { flex: 1, fontSize: 15, color: colors.dark, height: 50, fontFamily: fonts.regular, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  note: { padding: space.md, borderRadius: radius.md, marginTop: space.md },
});
