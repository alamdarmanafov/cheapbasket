import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Card, Chip, Row, Txt } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { notify } from '@/lib/confirm';
import { useAuth } from '@/store/auth';

const KINDS: Array<{ id: 'question' | 'complaint' | 'suggestion'; label: string }> = [
  { id: 'question', label: 'Sual' },
  { id: 'complaint', label: 'Şikayət' },
  { id: 'suggestion', label: 'Təklif' },
];

/** "Dəstək": send a question, complaint or suggestion; lands in the admin panel. */
export default function Feedback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [kind, setKind] = useState<'question' | 'complaint' | 'suggestion'>('question');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(auth.user?.email ?? '');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!supabase) return notify('Xəta', 'Server konfiqurasiya olunmayıb.');
    if (message.trim().length < 5) return notify('Mesaj qısadır', 'Zəhmət olmasa bir neçə söz yaz.');
    setBusy(true);
    const { error } = await supabase.from('feedback').insert({ user_id: auth.user?.id ?? null, email: email.trim() || null, kind, message: message.trim(), platform: Platform.OS });
    setBusy(false);
    if (error) return notify('Göndərilmədi', error.message);
    notify('Təşəkkürlər 🙌', 'Mesajın bizə çatdı. Lazım olsa e-poçtla cavab yazacağıq.');
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Dəstək" />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        <Txt v="body" color={colors.gray}>
          Sualın, şikayətin və ya təklifin var? Yaz, oxuyuruq.
        </Txt>
        <Row gap={8} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
          {KINDS.map((k) => (
            <Chip key={k.id} text={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </Row>
        <Card style={{ marginTop: space.md }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={kind === 'complaint' ? 'Nə baş verdi? Hansı market, hansı məhsul…' : kind === 'suggestion' ? 'Nəyi yaxşılaşdıraq?' : 'Sualını yaz…'}
            placeholderTextColor={colors.grayLight}
            multiline
            style={styles.input}
            textAlignVertical="top"
          />
        </Card>
        <Card style={{ marginTop: space.sm }}>
          <TextInput value={email} onChangeText={setEmail} placeholder="E-poçt (cavab üçün, istəyə görə)" placeholderTextColor={colors.grayLight} keyboardType="email-address" autoCapitalize="none" style={[styles.input, { minHeight: 24 }]} />
        </Card>
        <Btn title="Göndər" icon="send" loading={busy} onPress={send} style={{ marginTop: space.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: { fontFamily: fonts.regular, fontSize: 15, color: colors.dark, minHeight: 120, padding: 0 },
});
