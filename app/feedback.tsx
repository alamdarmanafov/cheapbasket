import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Card, Chip, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useT, type Key } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { useAuth } from '@/store/auth';

// Labels are keys, not text: this runs at module scope where no hook exists.
const KINDS: Array<{ id: 'question' | 'complaint' | 'suggestion'; label: Key }> = [
  { id: 'question', label: 'fb.question' },
  { id: 'complaint', label: 'fb.complaint' },
  { id: 'suggestion', label: 'fb.suggestion' },
];

/** Support: send a question, complaint or suggestion; lands in the admin panel. */
export default function Feedback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const t = useT();
  const [kind, setKind] = useState<'question' | 'complaint' | 'suggestion'>('question');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(auth.user?.email ?? '');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!supabase) return notify(t('fb.error'), t('fb.noServer'));
    if (message.trim().length < 5) return notify(t('fb.tooShort'), t('fb.tooShortBody'));
    setBusy(true);
    const { error } = await supabase.from('feedback').insert({ user_id: auth.user?.id ?? null, email: email.trim() || null, kind, message: message.trim(), platform: Platform.OS });
    setBusy(false);
    if (error) return notify(t('fb.notSent'), error.message);
    notify(t('fb.thanks'), t('fb.thanksBody'));
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('fb.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Txt v="body" color={colors.gray}>
          Sualın, şikayətin və ya təklifin var? Yaz, oxuyuruq.
        </Txt>
        <Row gap={8} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          {KINDS.map((k) => (
            <Chip key={k.id} text={t(k.label)} active={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </Row>
        <Card style={{ marginTop: space.md }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={kind === 'complaint' ? t('fb.phComplaint') : kind === 'suggestion' ? t('fb.phSuggestion') : t('fb.phQuestion')}
            placeholderTextColor={colors.grayLight}
            multiline
            style={styles.input}
            textAlignVertical="top"
          />
        </Card>
        <Card style={{ marginTop: space.sm }}>
          <TextInput value={email} onChangeText={setEmail} placeholder={t('fb.emailLabel')} placeholderTextColor={colors.grayLight} keyboardType="email-address" autoCapitalize="none" style={[styles.input, { minHeight: 24 }]} />
        </Card>
        <Btn title={t('fb.send')} icon="send" loading={busy} onPress={send} style={{ marginTop: space.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.regular, fontSize: 15, color: colors.dark, minHeight: 120, padding: 0 },
});
