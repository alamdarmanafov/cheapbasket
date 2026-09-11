import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { colors, radius, space } from '@/theme';
import { Txt } from './ui';
import { Banner } from '@/data/products';

const INTERVAL_MS = 5000;

/** Auto-advancing promo slider (admin-managed banners). Pauses while the user drags. */
export function BannerSlider({ banners, width }: { banners: Banner[]; width?: number }) {
  const router = useRouter();
  const { width: screenW } = useWindowDimensions();
  // Real container width (the web phone frame is narrower than the window); window-based fallback until measured.
  const [measured, setMeasured] = useState(0);
  const w = width ?? (measured || Math.min(screenW, 430) - space.lg * 2);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next && next !== measured) setMeasured(next);
  };
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const paused = useRef(false);

  const goTo = useCallback(
    (i: number) => {
      const next = (i + banners.length) % banners.length;
      indexRef.current = next;
      setIndex(next);
      ref.current?.scrollTo({ x: next * w, animated: true });
    },
    [banners.length, w],
  );

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      if (!paused.current) goTo(indexRef.current + 1);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, [banners.length, goTo]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    indexRef.current = i;
    setIndex(i);
    paused.current = false;
  };

  const open = (b: Banner) => {
    if (!b.link) return;
    if (b.link.startsWith('/')) router.push(b.link as never);
    else Linking.openURL(b.link).catch(() => {});
  };

  if (!banners.length) return null;
  return (
    <View style={{ marginTop: space.md }} onLayout={onLayout}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={w}
        onScrollBeginDrag={() => (paused.current = true)}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        style={{ borderRadius: radius.lg }}
      >
        {banners.map((b) => (
          <Pressable key={b.id} onPress={() => open(b)} disabled={!b.link} accessibilityRole={b.link ? 'button' : undefined} style={[styles.slide, { width: w, backgroundColor: b.bgColor }]}>
            {b.imageUrl ? <Image source={{ uri: b.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} cachePolicy="disk" /> : null}
            {b.imageUrl ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} /> : null}
            <View style={{ maxWidth: '85%' }}>
              <Txt v="title" color={b.textColor} numberOfLines={2} style={{ fontSize: 20, lineHeight: 25 }}>
                {b.title}
              </Txt>
              {b.subtitle ? (
                <Txt v="caption" color={b.textColor} style={{ opacity: 0.9, marginTop: 4 }} numberOfLines={2}>
                  {b.subtitle}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((b, i) => (
            <Pressable key={b.id} onPress={() => goTo(i)} hitSlop={6} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { height: 132, borderRadius: radius.lg, padding: space.lg, justifyContent: 'center', overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.grayLight },
  dotActive: { width: 18, backgroundColor: colors.primary },
});
