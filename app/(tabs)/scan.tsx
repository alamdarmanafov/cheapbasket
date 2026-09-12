import React, { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { SuggestProduct } from '@/components/SuggestProduct';
import { UnitPrice } from '@/components/UnitPrice';
import { suggestSubstitute } from '@/lib/substitute';
import { pushRecent, readRecents, RECENT_SCANS } from '@/lib/recents';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAST_KEY = 'cb_scan_fast';
import { Product, StoreId, catalog, cheapest, findByBarcode, getStore, sortedPrices } from '@/data/products';
import { categoryLabel } from '@/data/categoryNames';
import { normalizeGtin } from '@/lib/gtin';
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
  // The code that produced "not found", so it can be suggested. `resolve` only
  // ever saw the product lookup's result; the code itself used to be gone by
  // the time the sheet came up.
  const [code, setCode] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    readRecents(RECENT_SCANS).then(setRecentIds);
  }, []);
  const recentProducts = recentIds.map((id) => cat.products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  const lockRef = useRef(false);
  const camRef = useRef<CameraView>(null);

  // Which store is the user standing in? The route can say, the user can say,
  // and the nearest branch is a fair guess when the location is known. It
  // used to fall back to the first store alphabetically, and then judge
  // "good to buy here" against it — advice about Araz for someone standing
  // in Bravo. With nothing to go on the chip asks instead of asserting.
  const [picked, setPicked] = useState<StoreId | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const nearest = cat.locationGranted === true ? cat.branches[0]?.storeId : undefined;
  const hereId = ((params.store as StoreId) || picked || nearest || '') as StoreId;
  const here = hereId ? getStore(hereId) : null;

  useEffect(() => {
    if (Platform.OS !== 'web' && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [permission, requestPermission]);

  // Fast mode: every recognised product goes straight into the basket and the
  // viewfinder comes back on its own. Twenty products in an aisle is twenty
  // sheets to dismiss otherwise. Remembered across launches; not-found still
  // stops, since that needs a decision.
  const [fast, setFast] = useState(false);
  const [flash, setFlash] = useState<Product | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(FAST_KEY).then((v) => setFast(v === '1')).catch(() => undefined);
  }, []);
  const toggleFast = () => {
    setFast((f) => {
      AsyncStorage.setItem(FAST_KEY, f ? '0' : '1').catch(() => undefined);
      return !f;
    });
  };

  const resolve = (scanned: string, p: Product | undefined) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setCode(normalizeGtin(scanned) ?? '');
    track('scan', { product_id: p?.id ?? null, found: !!p, store_id: hereId, fast });
    if (fast && p) {
      basket.add(p);
      pushRecent(RECENT_SCANS, p.id).then(setRecentIds);
      setFlash(p);
      setTimeout(() => {
        setFlash(null);
        lockRef.current = false;
      }, 1100);
      return;
    }
    setPhase('searching');
    setTimeout(() => {
      if (p) {
        setProduct(p);
        setPhase('found');
        pushRecent(RECENT_SCANS, p.id).then(setRecentIds);
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
    resolve(code, findByBarcode(code));
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
          onBarcodeScanned={phase === 'scanning' ? ({ data }) => resolve(data, findByBarcode(data)) : undefined}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fakeCam]}>
          <Txt style={{ fontSize: 120, lineHeight: 140, opacity: 0.25 }}>🥛</Txt>
        </View>
      )}

      {/* Top bar */}
      <Row style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, justifyContent: 'space-between' }}>
        <IconBtn name="close" bg="rgba(255,255,255,0.15)" color={colors.white} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} label={t('common.close')} />
        <Pressable onPress={() => setPickOpen(true)} style={styles.hereChip} accessibilityRole="button" accessibilityLabel={t('scan.pickStoreTitle')}>
          {here && <StoreAvatar store={here} size={20} />}
          <Txt v="captionStrong" color={colors.white} style={{ marginLeft: here ? 6 : 0 }} numberOfLines={1}>
            {here ? t('scan.youAreAt', { store: here.name }) : t('scan.pickStore')}
          </Txt>
          <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
        </Pressable>
        <Row gap={8}>
          <IconBtn name={fast ? 'flash' : 'flash-outline'} bg={fast ? colors.success : 'rgba(255,255,255,0.15)'} color={colors.white} label={t('scan.fastMode')} onPress={toggleFast} />
          <IconBtn name={torch ? 'flashlight' : 'flashlight-outline'} bg={torch ? colors.primary : 'rgba(255,255,255,0.15)'} color={colors.white} label={t('scan.torch')} onPress={() => (canUseCamera ? setTorch((t) => !t) : notify(t('scan.torch'), t('scan.torchOnlyApp')))} />
        </Row>
      </Row>

      {/* Fast mode: what just went in, and where the basket stands. */}
      {fast && phase === 'scanning' && (
        <View style={[styles.fastBar, { top: insets.top + space.sm + 48 }]} pointerEvents="box-none">
          <View style={styles.fastPill}>
            <Ionicons name="flash" size={14} color={colors.white} />
            <Txt v="captionStrong" color={colors.white} style={{ marginLeft: 6 }}>
              {t('scan.fastOn')}
            </Txt>
          </View>
          {flash && (
            <View style={[styles.fastPill, { backgroundColor: colors.success, marginTop: 8 }]}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
              <Txt v="captionStrong" color={colors.white} numberOfLines={1} style={{ marginLeft: 6, maxWidth: 240 }}>
                {t('scan.fastAdded', { name: `${flash.brand} ${flash.name}`.trim() })}
              </Txt>
            </View>
          )}
        </View>
      )}
      {fast && phase === 'scanning' && basket.count > 0 && (
        <Pressable onPress={() => router.replace('/basket')} style={[styles.fastFooter, { bottom: insets.bottom + 24 }]} accessibilityRole="button">
          <Ionicons name="basket" size={18} color={colors.white} />
          <Txt v="bodyStrong" color={colors.white} style={{ flex: 1, marginLeft: 8 }}>
            {t('scan.fastBasket', { count: basket.count })}
          </Txt>
          {basket.optimization.best && (
            <Txt v="bodyStrong" color={colors.white} num>
              {basket.optimization.best.total.toFixed(2)} ₼
            </Txt>
          )}
        </Pressable>
      )}

      {phase === 'scanning' && (
        <View style={styles.center} pointerEvents="box-none">
          <Frame />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            {t('scan.frameHint')}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            {t('scan.frameBody')}
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

      {phase === 'scanning' && recentProducts.length > 0 && (
        <View style={[styles.recentRow, { bottom: insets.bottom + (fast && basket.count > 0 ? 150 : 92) }]} pointerEvents="box-none">
          <Txt v="caption" color="rgba(255,255,255,0.7)" style={{ marginLeft: space.lg, marginBottom: 6 }}>
            {t('scan.recent')}
          </Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 8 }}>
            {recentProducts.map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={styles.recentChip} accessibilityRole="button">
                <ProductArt product={p} size={24} emojiScale={0.6} />
                <Txt v="captionStrong" color={colors.white} numberOfLines={1} style={{ marginLeft: 6, maxWidth: 140 }}>
                  {p.brand} {p.name}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {phase === 'searching' && (
        <View style={styles.center}>
          <Frame active />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            {t('scan.searching')}
          </Txt>
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            {t('scan.searchingBody', { n: cat.stores.length })}
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
          {/* "Not found" was a dead end: the person is holding a product we do
              not list and had no way to tell us. Now the code goes to the
              admin's queue with a name, and approval pays them back in points. */}
          {code.length >= 8 && <SuggestProduct barcode={code} storeId={hereId} title={t('scan.suggest')} onDone={reset} />}
        </View>
      )}


      <Modal visible={pickOpen} transparent animationType="fade" onRequestClose={() => setPickOpen(false)}>
        <Pressable style={styles.pickBackdrop} onPress={() => setPickOpen(false)} accessibilityLabel={t('common.close')} />
        <View style={[styles.pickSheet, { paddingBottom: insets.bottom + space.lg }]}>
          <Txt v="bodyStrong">{t('scan.pickStoreTitle')}</Txt>
          <Txt v="caption" color={colors.gray} style={{ marginTop: 2, marginBottom: space.sm }}>
            {t('scan.pickStoreBody')}
          </Txt>
          <ScrollView style={{ maxHeight: 360 }}>
            {cat.stores.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setPicked(s.id);
                  setPickOpen(false);
                }}
                style={({ pressed }) => [styles.pickRow, pressed && { backgroundColor: colors.fill }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: s.id === hereId }}
              >
                <StoreAvatar store={s} size={28} />
                <Txt v="body" style={{ flex: 1, marginLeft: 10, fontSize: 14 }}>
                  {s.name}
                </Txt>
                {s.id === nearest && (
                  <Txt v="caption" color={colors.gray} style={{ marginRight: 8, fontSize: 11 }}>
                    {t('scan.nearestHint')}
                  </Txt>
                )}
                {s.id === hereId && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

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
  const herePrice = here ? product.prices[here] : undefined;
  const hereStore = getStore(here);
  const diff = herePrice != null && c.price != null ? herePrice - c.price : null;
  // No store known → no verdict. A cheapest price is still a fact; "good to
  // buy here" without a "here" is not.
  const verdict: { tone: 'success' | 'warning' | 'neutral'; title: string; body: string } | null = !here
    ? null
    : herePrice == null
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
              {product.size} · {categoryLabel(product.category)}
            </Txt>
          </View>
        </Row>

        {/* Verdict for this store */}
        {verdict && (
          <View style={[styles.verdict, verdict.tone === 'success' ? { backgroundColor: colors.successSoft } : verdict.tone === 'warning' ? { backgroundColor: colors.warningSoft } : { backgroundColor: colors.fill }]}>
            <Txt v="bodyStrong" color={verdict.tone === 'success' ? colors.success : verdict.tone === 'warning' ? colors.warning : colors.gray}>
              {verdict.title}
            </Txt>
            <Txt v="caption" color={colors.gray} style={{ marginTop: 2 }}>
              {verdict.body}
            </Txt>
            {here && herePrice == null && (() => {
              const alt = suggestSubstitute(product, here);
              return alt ? (
                <Txt v="caption" color={colors.primary} style={{ marginTop: 4 }}>
                  {t('basket.substitute', { name: `${alt.product.brand} ${alt.product.name}`.trim(), price: alt.price.toFixed(2) })}
                </Txt>
              ) : null;
            })()}
          </View>
        )}

        {/* Cheapest + list */}
        <Row style={{ marginTop: space.lg, justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Txt v="caption" color={colors.gray}>
              {t('scan.cheapestLabel')}
            </Txt>
            {c.price != null && <Price value={c.price} size="lg" color={colors.primary} />}
            <UnitPrice price={c.price} size={product.size} />
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
                    {t('scan.unavailable')}
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
  hereChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, height: 36, borderRadius: radius.pill, maxWidth: 200 },
  recentRow: { position: 'absolute', left: 0, right: 0 },
  fastBar: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  fastPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  fastFooter: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dark, borderRadius: radius.pill, paddingHorizontal: 16, height: 52 },
  recentChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.pill, paddingHorizontal: 10, height: 36 },
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  pickSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.md },
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
