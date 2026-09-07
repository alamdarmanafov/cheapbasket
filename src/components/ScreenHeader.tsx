import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { IconBtn, Row, Txt } from './ui';

export function ScreenHeader({
  title,
  right,
  onBack,
  transparent,
  closeIcon = false,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  transparent?: boolean;
  closeIcon?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <Row
      style={{
        paddingTop: insets.top + space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        backgroundColor: transparent ? 'transparent' : colors.bg,
        justifyContent: 'space-between',
      }}
    >
      <IconBtn name={closeIcon ? 'close' : 'chevron-back'} onPress={back} bg={transparent ? 'rgba(255,255,255,0.9)' : colors.white} label="Geri" />
      {title ? (
        <Txt v="bodyStrong" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: space.md }}>
          {title}
        </Txt>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
    </Row>
  );
}
