import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Divider, IconBtn, Pill, Price, Row, Txt } from '@/components/ui';
import { Freshness, ProductArt, StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { Product, StoreId, catalog, cheapest, findByBarcode, getStore, sortedPrices } from '@/data/products';
import { useBasket } from '@/store/basket';

type Phase = 'scanning' | 'searching' | 'found' | 'notfound' | 'error';

/**
 * In-store scanner. Recognises a product, compares prices, and tells the user
 * whether buying it *here* is a good deal for their basket.
 */
export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; store?: string }>();
  const mode = params.mode === 'photo' ? 'photo' : 'barcode';
  const basket = useBasket();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [product, setProduct] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);
  const lockRef = useRef(false);

  // Which store is the user standing in? Defaults to the AI's best store for their basket.
  const hereId = ((params.store as StoreId) || basket.optimization.best?.store.id || catalog.stores[0]?.id || '') as StoreId;
  const here = getStore(hereId);

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const resolve = (p: Product | undefined) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setPhase('searching');
    setTimeout(() => {
      if (p) {
        setProduct(p);
        setPhase('found');
      } else {
        setPhase('notfound');
      }
    }, 900);
  };

  const reset = () => {
    lockRef.current = false;
    setProduct(null);
    setAdded(false);
    setPhase('scanning');
  };

  const canUseCamera = Platform.OS !== 'web' && permission?.granted;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
      {/* Viewfinder */}
      {canUseCamera ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={phase === 'scanning' ? ({ data }) => resolve(findByBarcode(data)) : undefined}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fakeCam]}>
          <Txt style={{ fontSize: 120, lineHeight: 140, opacity: 0.25 }}>🥛</Txt>
        </View>
      )}

      {/* Top bar */}
      <Row style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, justifyContent: 'space-between' }}>
        <IconBtn name="close" bg="rgba(255,255,255,0.15)" color={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label="Bağla" />
        <View style={styles.hereChip}>
          <StoreAvatar store={here} size={20} />
          <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6 }}>
            {here.name}-dasan
          </Txt>
        </View>
        <IconBtn name="flashlight-outline" bg="rgba(255,255,255,0.15)" color={colors.white} label="Fənər" />
      </Row>

      {phase === 'scanning' && (
        <View style={styles.center} pointerEvents="box-none">
          <Frame />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            {mode === 'photo' ? 'Məhsulu çərçivəyə gətir və şəkil çək' : 'Barkodu çərçivəyə gətir'}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            Məhsul tanındıqdan sonra qiymətləri avtomatik müqayisə edəcəyik.
          </Txt>
          <View style={{ marginTop: space.xxl, alignItems: 'center', gap: space.sm }}>
            {mode === 'photo' && (
              <Pressable onPress={() => resolve(catalog.products[0])} style={styles.shutter} accessibilityLabel="Şəkil çək">
                <View style={styles.shutterInner} />
              </Pressable>
            )}
            {!canUseCamera && mode === 'barcode' && (
              <Btn title="Demo: barkodu oxu" variant="secondary" size="md" full={false} onPress={() => resolve(catalog.products[0])} />
            )}
          </View>
        </View>
      )}

      {phase === 'searching' && (
        <View style={styles.center}>
          <Frame active />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            Məhsul axtarılır…
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            4 marketdə qiymətlər yoxlanılır
          </Txt>
        </View>
      )}

      {phase === 'notfound' && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <StateView
            emoji="🤔"
            title="Məhsul tapılmadı"
            body="Bu barkod bazamızda yoxdur. Adı ilə axtar və ya yenidən cəhd et."
            cta="Adı ilə axtar"
            onCta={() => router.replace('/search')}
            secondary="Yenidən skan et"
            onSecondary={reset}
          />
        </View>
      )}

      {phase === 'found' && product && (
        <FoundSheet
          product={product}
          here={hereId}
          added={added}
          onAdd={() => {
            basket.add(product);
            setAdded(true);
          }}
          onRescan={reset}
          onCompare={() => router.push(`/product/${product.id}`)}
          onBasket={() => router.replace('/basket')}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

function FoundSheet({
  product,
  here,
  added,
  onAdd,
  onRescan,
  onCompare,
  onBasket,
  bottomInset,
}: {
  product: Product;
  here: StoreId;
  added: boolean;
  onAdd: () => void;
  onRescan: () => void;
  onCompare: () => void;
  onBasket: () => void;
  bottomInset: number;
}) {
  const prices = sortedPrices(product);
  const c = cheapest(product);
  const herePrice = product.prices[here];
  const hereStore = getStore(here);
  const diff = herePrice != null && c.price != null ? herePrice - c.price : null;
  const verdict: { tone: 'success' | 'warning' | 'neutral'; title: string; body: string } =
    herePrice == null
      ? { tone: 'neutral', title: `${hereStore.name}-da mövcud deyil`, body: `Ən ucuz ${c.store.name}-da: ${c.price?.toFixed(2)} ₼` }
      : diff != null && diff <= 0.05
        ? { tone: 'success', title: 'Burada almaq sərfəlidir ✓', body: `${hereStore.name} bu məhsulda ən ucuzdur.` }
        : { tone: 'warning', title: 'Burada almaq sərfəli deyil', body: `${c.store.name}-da ${diff?.toFixed(2)} ₼ daha ucuzdur (${c.price?.toFixed(2)} ₼).` };

  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset + space.md, maxHeight: '78%' }]}>
      <View style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <Pill tone="success" icon="checkmark-circle" text="Məhsul tapıldı" />
        </Row>
        <Row gap={space.md} style={{ marginTop: space.lg }}>
          <ProductArt product={product} size={80} />
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.gray}>
              {product.brand}
            </Txt>
            <Txt v="title" numberOfLines={2}>
              {product.name}
            </Txt>
            <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
              {product.size} · {product.category}
            </Txt>
          </View>
        </Row>

        {/* Verdict for this store */}
        <View style={[styles.verdict, verdict.tone === 'success' ? { backgroundColor: colors.successSoft } : verdict.tone === 'warning' ? { backgroundColor: colors.warningSoft } : { backgroundColor: colors.fill }]}>
          <Txt v="bodyStrong" color={verdict.tone === 'success' ? colors.success : verdict.tone === 'warning' ? colors.warning : colors.gray}>
            {verdict.title}
          </Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
            {verdict.body}
          </Txt>
        </View>

        {/* Cheapest + list */}
        <Row style={{ marginTop: space.lg, justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Txt v="caption" color={colors.gray}>
              Ən ucuz qiymət
            </Txt>
            {c.price != null && <Price value={c.price} size="lg" color={colors.primary} />}
            <Row gap={6} style={{ marginTop: 4 }}>
              <StoreAvatar store={c.store} size={20} />
              <Txt v="captionStrong">{c.store.name}</Txt>
            </Row>
          </View>
          <Freshness minutes={product.updatedMinutesAgo} />
        </Row>
        <View style={{ marginTop: space.md }}>
          {prices.slice(1).map((s, i) => (
            <React.Fragment key={s.store.id}>
              {i > 0 && <Divider />}
              <Row style={{ paddingVertical: 10 }} gap={space.sm}>
                <StoreAvatar store={s.store} size={24} />
                <Txt v="body" style={{ flex: 1 }} color={s.price == null ? colors.grayLight : colors.dark}>
                  {s.store.name}
                </Txt>
                {s.price != null ? (
                  <Txt v="bodyStrong" num>
                    {s.price.toFixed(2)} ₼
                  </Txt>
                ) : (
                  <Txt v="caption" color={colors.grayLight}>
                    mövcud deyil
                  </Txt>
                )}
              </Row>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        {added ? (
          <Btn title="Səbətə əlavə edildi ✓ · Səbətə bax" variant="dark" icon="basket" onPress={onBasket} />
        ) : (
          <Btn title="Səbətə əlavə et" icon="add" onPress={onAdd} />
        )}
        <Row gap={space.sm}>
          <Btn title="Müqayisəyə bax" variant="secondary" size="md" onPress={onCompare} style={{ flex: 1 }} />
          <Btn title="Yenidən skan et" variant="ghost" size="md" onPress={onRescan} style={{ flex: 1 }} />
        </Row>
      </View>
    </View>
  );
}

/** Corner-bracket scan frame with a moving laser line. */
function Frame({ active }: { active?: boolean }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);
  const size = 260;
  const c = active ? colors.success : colors.white;
  const corner = (pos: object) => <View style={[styles.corner, { borderColor: c }, pos]} />;
  return (
    <View style={{ width: size, height: size * 0.72 }}>
      {corner({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 })}
      {corner({ top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 })}
      {corner({ bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 })}
      {corner({ bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 })}
      <Animated.View
        style={[
          styles.laser,
          { backgroundColor: colors.primary, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [16, size * 0.72 - 16] }) }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fakeCam: { backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  hereChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, height: 36, borderRadius: radius.pill },
  corner: { position: 'absolute', width: 36, height: 36 },
  laser: { position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 1, opacity: 0.9 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    ...shadow.card,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space.md },
  verdict: { marginTop: space.lg, padding: space.md, borderRadius: radius.md },
});
