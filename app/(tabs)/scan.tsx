import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
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
import { PlusTag } from '@/components/PlusLock';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Divider, IconBtn, Pill, Price, Row, Txt } from '@/components/ui';
import { Freshness, ProductArt, StoreAvatar } from '@/components/product';
import { StateView } from '@/components/states';
import { Product, StoreId, catalog, cheapest, findByBarcode, getStore, sortedPrices } from '@/data/products';
import { useBasket } from '@/store/basket';

type Phase = 'scanning' | 'searching' | 'found' | 'notfound' | 'error' | 'limit' | 'login';

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
  const auth = useAuth();
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

  /** Photo mode: capture → server vision model → best catalogue match. */
  const takePhoto = async () => {
    if (lockRef.current) return;
    if (!camRef.current) return setHint('Kamera hazır deyil.');
    if (!API_URL) return setHint('Server konfiqurasiya olunmayıb (EXPO_PUBLIC_API_URL).');
    if (!auth.user) {
      setPhase('login');
      return;
    }
    lockRef.current = true;
    setPhase('searching');
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      const pic = await camRef.current.takePictureAsync({ base64: true, quality: 0.4, skipProcessing: true });
      const res = await fetch(`${API_URL}/api/ai/identify`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` }, body: JSON.stringify({ image: pic?.base64 ?? '' }) });
      const j = (await res.json()) as { identified?: { query: string }; candidates?: Array<{ id: string }>; remaining?: number | null; error?: string; code?: string };
      if (res.status === 429 || j.code === 'limit') {
        setHint(j.error ?? null);
        setPhase('limit');
        return;
      }
      if (res.status === 401 || j.code === 'auth') {
        setPhase('login');
        return;
      }
      if (!res.ok) throw new Error(j.error ?? `Server xətası (${res.status})`);
      if (j.remaining != null) setHint(j.remaining > 0 ? `Bu gün daha ${j.remaining} pulsuz foto qalır.` : 'Bu günkü pulsuz foto istifadə olundu. Limitsiz tanıma Plus-dadır.');
      const top = j.candidates?.[0] ? catalog.products.find((p) => p.id === j.candidates?.[0].id) : undefined;
      track('photo', { product_id: top?.id ?? null, found: !!top, query: j.identified?.query ?? null });
      if (top) {
        setProduct(top);
        setPhase('found');
      } else {
        setHint(j.identified?.query ? `Tanındı: "${j.identified.query}" — bazamızda hələ yoxdur.` : null);
        setPhase('notfound');
      }
    } catch (e) {
      setHint((e as Error).message);
      setPhase('notfound');
    }
  };

  const submitManual = () => {
    const code = manual.replace(/\D/g, '');
    if (code.length < 8) return;
    resolve(findByBarcode(code));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0B' }}>
      {/* Viewfinder */}
      {canUseCamera ? (
        <CameraView
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
          onBarcodeScanned={phase === 'scanning' && mode === 'barcode' ? ({ data }) => resolve(findByBarcode(data)) : undefined}
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
        <IconBtn name={torch ? 'flashlight' : 'flashlight-outline'} bg={torch ? colors.primary : 'rgba(255,255,255,0.15)'} color={colors.white} label="Fənər" onPress={() => (canUseCamera ? setTorch((t) => !t) : notify('Fənər', 'Fənər yalnız telefon tətbiqində, kamera açıq olanda işləyir.'))} />
      </Row>

      {phase === 'scanning' && (
        <View style={styles.center} pointerEvents="box-none">
          <Frame />
          <Txt v="bodyStrong" color={colors.white} center style={{ marginTop: space.xl }}>
            {mode === 'photo' ? 'Məhsulu çərçivəyə gətir və şəkil çək' : 'Barkodu çərçivəyə gətir'}
          </Txt>
          {mode === 'photo' && !basket.isPlus && (
            <Row gap={6} style={{ justifyContent: 'center', marginTop: 6 }}>
              <PlusTag />
              <Txt v="caption" color="rgba(255,255,255,0.8)">
                Pulsuz planda gündə 1 foto
              </Txt>
            </Row>
          )}
          <Txt v="caption" color="rgba(255,255,255,0.7)" center style={{ marginTop: 4 }}>
            Məhsul tanındıqdan sonra qiymətləri avtomatik müqayisə edəcəyik.
          </Txt>
          <View style={{ marginTop: space.xxl, alignItems: 'center', gap: space.sm }}>
            {mode === 'photo' && canUseCamera && (
              <Pressable onPress={takePhoto} style={styles.shutter} accessibilityLabel="Şəkil çək">
                <View style={styles.shutterInner} />
              </Pressable>
            )}
            {mode === 'photo' && !canUseCamera && (
              <>
                <Txt v="caption" color="rgba(255,255,255,0.8)" center>
                  {Platform.OS === 'web' ? 'Şəkillə tanıma yalnız telefon tətbiqində işləyir.' : 'Kameraya icazə lazımdır.'}
                </Txt>
                {Platform.OS !== 'web' && !permission?.granted && <Btn title="Kameraya icazə ver" size="md" full={false} onPress={() => requestPermission()} />}
                <Btn title="Adı ilə axtar" variant="secondary" size="md" full={false} onPress={() => router.replace('/search')} />
              </>
            )}
            {mode === 'barcode' && !canUseCamera && (
              <View style={{ width: '100%', alignItems: 'center', gap: space.sm }}>
                <Txt v="caption" color="rgba(255,255,255,0.8)" center>
                  {Platform.OS === 'web' ? 'Kamera ilə skan telefon tətbiqindədir. Barkodu əl ilə yaz:' : 'Kameraya icazə yoxdur. Barkodu əl ilə yaz:'}
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
                {Platform.OS !== 'web' && permission && !permission.granted && <Btn title="Kameraya icazə ver" variant="secondary" size="md" full={false} onPress={() => requestPermission()} />}
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
            title="Məhsul tapılmadı"
            body={hint ?? (mode === 'photo' ? 'Məhsul tanınmadı. Adı ilə axtar və ya yenidən şəkil çək.' : 'Bu barkod bazamızda yoxdur. Adı ilə axtar və ya yenidən cəhd et.')}
            cta="Adı ilə axtar"
            onCta={() => router.replace('/search')}
            secondary={mode === 'photo' ? 'Yenidən çək' : 'Yenidən skan et'}
            onSecondary={reset}
          />
        </View>
      )}

      {phase === 'limit' && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <StateView
            emoji="⭐"
            title="Bu günkü pulsuz foto bitdi"
            body={hint ?? 'Pulsuz planda gündə 1 foto. Plus ilə limitsiz şəkillə tanıma, qiymət tarixçəsi və hər gün endirim xəbəri.'}
            cta="Plus-a keç"
            onCta={() => router.push('/plus')}
            secondary="Barkodla skan et"
            onSecondary={() => {
              reset();
              router.replace('/scan');
            }}
          />
        </View>
      )}

      {phase === 'login' && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <StateView emoji="👤" title="Daxil ol" body="Şəkillə tanıma üçün hesabına daxil olmalısan. Pulsuz planda gündə 1 foto, Plus-da limitsiz." cta="Daxil ol" onCta={() => router.push('/auth')} secondary="Geri" onSecondary={reset} />
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
  manualRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: space.lg, width: '100%', maxWidth: 360 },
  manualInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', color: colors.white, borderRadius: 12, paddingHorizontal: 14, height: 44, fontFamily: fonts.semibold, fontSize: 16, letterSpacing: 1 },
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
