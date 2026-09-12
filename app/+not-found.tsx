import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StateView } from '@/components/states';
import { colors } from '@/theme';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const router = useRouter();
  const t = useT();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
      <StateView emoji="🧭" title={t('notFound.title')} body={t('notFound.body')} cta={t('notFound.cta')} onCta={() => router.replace('/')} />
    </View>
  );
}
