import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StateView } from '@/components/states';
import { colors } from '@/theme';

export default function NotFound() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
      <StateView emoji="🧭" title="Səhifə tapılmadı" body="Bu keçid mövcud deyil." cta="Ana səhifəyə qayıt" onCta={() => router.replace('/')} />
    </View>
  );
}
