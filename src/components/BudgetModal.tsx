import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '@/theme';
import { Btn, Txt } from './ui';
import { setBudget } from '@/lib/budget';
import { useT } from '@/lib/i18n';

/** One number: how much this basket may cost. Empty clears the limit. */
export function BudgetModal({ visible, value, onClose }: { visible: boolean; value: number | null; onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText(value != null ? String(value) : '');
  }, [visible, value]);
  const save = () => {
    const n = Number(text.replace(',', '.'));
    setBudget(Number.isFinite(n) && n > 0 ? n : null);
    onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
        <View style={styles.card}>
          <Txt v="title">{t('budget.title')}</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 4 }}>
            {t('budget.body')}
          </Txt>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder={t('budget.placeholder')}
              placeholderTextColor={colors.grayLight}
              style={styles.input}
              autoFocus
              testID="budget-input"
              onSubmitEditing={save}
            />
            <Txt v="bodyStrong" color={colors.gray}>
              ₼
            </Txt>
          </View>
          <Btn title={t('budget.save')} size="md" onPress={save} style={{ marginTop: space.md }} />
          {value != null && (
            <Btn
              title={t('budget.clear')}
              variant="ghost"
              size="md"
              onPress={() => {
                setBudget(null);
                onClose();
              }}
              style={{ marginTop: space.xs }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { marginTop: 'auto', marginBottom: 'auto', marginHorizontal: space.lg, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.xl },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, paddingHorizontal: space.md, marginTop: space.md, backgroundColor: colors.fill },
  input: { flex: 1, fontSize: 22, fontFamily: fonts.bold, color: colors.dark, paddingVertical: 12 },
});
