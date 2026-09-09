import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { API_URL } from '@/lib/plusStore';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/track';
import { useAuth } from '@/store/auth';
import { useCatalog } from '@/store/catalog';
import { notify } from '@/lib/confirm';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Divider, IconBtn, Pill, Price, Row, Txt } from '@/components/ui';
import { Freshness, ProductArt, StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { Product, StoreId, catalog, cheapest, findByBarcode, getStore, sortedPrices } from '@/data/products';
import { useBasket } from '@/store/basket';
import { useT } from '@/lib/i18n';

type Phase = 'scanning' | 'searching' | 'found' | 'notfound' | 'error';

/**
 * In-store scanner. Recognises a product, compares prices, and tells the user
 * whether buying it *here* is a good deal for their basket.
 */
export default function Scan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ store?: string }>();
  const basket = useBasket();
  const auth = useAuth();
  const t = useT();
  const cat = useCatalog();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [product, setProduct] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const lockRef = useRef(false);
  const camRef = useRef<CameraView>(null);

  // Which store is the user standing in? Defaults to the AI's best store for their basket.
  const hereId = ((params.store as StoreId) || basket.optimization.best?.store.id || cat.stores[0]?.id || '') as StoreId;
  const here = getStore(hereId);

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  const resolve = (p: Product | undefined) => {
    if (lockRef.current) return;
    lockRef.current = true;
    track('scan', { product_id: p?.id ?? null, found: !!p, store_id: hereId });
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
    setHint(null);
    setPhase('scanning');
  };

  const canUseCamera = Platform.OS !== 'web' && permission?.granted;

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length < 8) return;
    resolve(findByBarcode(code));
  };

  return (
    // Without a camera the barcode is typed in by hand, and the keyboard covered
    // the field.
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
      {/* Viewfinder */}
      {canUseCamera ? (
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
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
        <IconBtn name="close" bg="rgba(255,255,255,0.15)" color={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label={t('common.close')} />
        <View style={styles.hereChip}>
          <StoreAvatar store={here} size={20} />
          <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6 }}>
            {here.name}-dasan
          </Txt>
        </View>
        <IconBtn name={torch ? 'flashlight' : 'flashlight-outline'} bg={torch ? colors.primary : 'rgba(255,255,255,0.15)'} color={colors.white} label={t('scan.torch')} onPress={() => (canUseCamera ? setTorch((t) => !t) : notify(t('scan.torch'), t('scan.torchOnlyApp')))} />
      </Row>

      {phase === 'scanning' && (
        <View style={styles.center} pointerEvents="box-none">
          <Frame />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            Barkodu çərçivəyə gətir
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            Məhsul tanındıqdan sonra qiymətləri avtomatik müqayisə edəcəyik.
          </Txt>
          <View style={{ marginTop: space.xxl, alignItems: 'center', gap: space.sm }}>
            {!canUseCamera && (
              <View style={{ width: '100%', alignItems: 'center', gap: space.sm }}>
                <Txt v="caption" color="rgba(255,255,255,0.8)" center>
                  {Platform.OS === 'web' ? t('scan.webHint') : t('scan.noPermission')}
                </Txt>
                <View style={styles.manualRow}>
                  <TextInput
                    value={manual}
                    onChangeText={setManual}
                    placeholder="8690767010012"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="number-pad"
                    returnKeyType="search"
                    onSubmitEditing={submitManual}
                    style={styles.manualInput}
                  />
                  <Btn title="Tap" size="md" full={false} onPress={submitManual} disabled={manual.replace(/\D/g, '').length < 8} />
                </View>
                {Platform.OS !== 'web' && permission && !permission.granted && <Btn title={t('scan.allowCamera')} variant="secondary" size="md" full={false} onPress={() => requestPermission()} />}
              </View>
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
            {cat.stores.length} marketdə qiymətlər yoxlanılır
          </Txt>
        </View>
      )}

      {phase === 'notfound' && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <StateView
            emoji="🤔"
            title={t('scan.notFound')}
            body={hint ?? t('scan.notFoundBody')}
            cta={t('scan.searchByName')}
            onCta={() => router.replace('/search')}
            secondary={t('scan.again')}
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
    </KeyboardAvoidingView>
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
  const t = useT();
  const prices = sortedPrices(product);
  const c = cheapest(product);
  const herePrice = product.prices[here];
  const hereStore = getStore(here);
  const diff = herePrice != null && c.price != null ? herePrice - c.price : null;
  const verdict: { tone: 'success' | 'warning' | 'neutral'; title: string; body: string } =
    herePrice == null
      ? { tone: 'neutral', title: t('scan.notSoldHere', { store: hereStore.name }), body: t('scan.cheapestAt', { store: c.store.name, price: c.price?.toFixed(2) ?? '' }) }
      : diff != null && diff <= 0.05
        ? { tone: 'success', title: t('scan.goodBuy'), body: t('scan.goodBuyBody', { store: hereStore.name }) }
        : { tone: 'warning', title: t('scan.badBuy'), body: t('scan.badBuyBody', { store: c.store.name, diff: diff?.toFixed(2) ?? '', price: c.price?.toFixed(2) ?? '' }) };

  return (
    <View style={[styles.sheet, { paddingBottom: bottomInset + space.md, maxHeight: '78%' }]}>
      <View style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Row gap={6} style={{ justifyContent: 'center' }}>
          <Pill tone="success" icon="checkmark-circle" text={t('scan.found')} />
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
          <Btn title={t('scan.addedGo')} variant="dark" icon="basket" onPress={onBasket} />
        ) : (
          <Btn title={t('scan.add')} icon="add" onPress={onAdd} />
        )}
        <Row gap={space.sm}>
          <Btn title={t('scan.compare')} variant="secondary" size="md" onPress={onCompare} style={{ flex: 1 }} />
          <Btn title={t('scan.again')} variant="ghost" size="md" onPress={onRescan} style={{ flex: 1 }} />
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
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: space.lg, width: '100%', maxWidth: 360 },
  manualInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', color: colors.white, borderRadius: 12, paddingHorizontal: 14, height: 44, fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 1 },
  fakeCam: { backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  hereChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, height: 36, borderRadius: radius.pill },
  corner: { position: 'absolute', width: 36, height: 36 },
  laser: { position: 'absolute', left: 12, right: 12, height: 2, borderRadius: 1, opacity: 0.9 },
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
