import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Card, Divider, Pill, Price, Row, Txt } from '@/components/ui';
import { ProductRow, StoreAvatar } from '@/components/product';
import { ProductRowSkeleton } from '@/components/states';
import { TopBar } from '@/components/TopBar';
import { PlusTag } from '@/components/PlusLock';
import { Product, catalogCategories, searchProducts } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { useBasket } from '@/store/basket';


export default function Home() {
  const router = useRouter();
  const basket = useBasket();
  const { optimization: o, lines } = basket;
  const cat = useCatalog();
  const categories = catalogCategories();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Inline search with a short simulated latency so the loading state is visible.
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      setResults(searchProducts(q));
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
        <Txt v="display" style={{ marginTop: space.xs }}>
          Bu gün{'\n'}
          <Txt v="display" color={colors.primary}>
            nə alırsan?
          </Txt>
        </Txt>
        <Txt v="caption" color={colors.gray} style={{ marginTop: space.sm, marginBottom: space.lg }}>
          Alış-verişə getməzdən əvvəl ən sərfəli səbətini hazırla.
        </Txt>

        {/* Search */}
        <Row style={styles.search} gap={space.sm}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Məhsul axtar..."
            placeholderTextColor={colors.grayLight}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Təmizlə">
              <Ionicons name="close-circle" size={18} color={colors.grayLight} />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/scan')} hitSlop={8} accessibilityLabel="Barkodu skan et">
              <Ionicons name="barcode-outline" size={20} color={colors.dark} />
            </Pressable>
          )}
        </Row>

        {/* Inline results */}
        {q.trim() !== '' && (
          <View style={styles.results}>
            <Txt v="bodyStrong" style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs }}>
              Məhsullar
            </Txt>
            {loading ? (
              <>
                <ProductRowSkeleton />
                <ProductRowSkeleton />
              </>
            ) : results && results.length ? (
              results.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && <Divider inset={84} />}
                  <ProductRow product={p} />
                </React.Fragment>
              ))
            ) : (
              <View style={{ alignItems: 'center', padding: space.xl }}>
                <Txt style={{ fontSize: 32, lineHeight: 40 }}>🔍</Txt>
                <Txt v="bodyStrong" style={{ marginTop: space.sm }}>
                  Məhsul tapılmadı
                </Txt>
                <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
                  Adı fərqli yaz və ya barkodu skan et.
                </Txt>
                <Btn title="Barkodu skan et" size="md" full={false} icon="barcode-outline" onPress={() => router.push('/scan')} style={{ marginTop: space.md }} />
              </View>
            )}
          </View>
        )}

        {/* Scan card */}
        <Pressable onPress={() => router.push('/scan')} accessibilityRole="button" style={({ pressed }) => [styles.scanCard, pressed && { opacity: 0.92 }]}>
          <View style={styles.scanSymbol}>
            <Ionicons name="barcode-outline" size={24} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt v="bodyStrong" color={colors.white}>
              Barkodu skan et
            </Txt>
            <Txt v="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 11 }}>
              Məhsulu tanı, ən ucuzunu tap
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.white} />
        </Pressable>

        {/* Quick grid */}
        <Row gap={10} style={{ marginTop: 10 }}>
          <QuickTile icon="camera-outline" label="Məhsulun şəklini çək" onPress={() => router.push('/scan?mode=photo')} />
          <QuickTile icon="list-outline" label="Siyahını əlavə et" onPress={() => router.push('/search')} />
        </Row>

        {/* Basket summary */}
        <Pressable onPress={() => router.push('/basket')} style={({ pressed }) => [styles.summary, pressed && { opacity: 0.9 }]}>
          <View style={{ flex: 1 }}>
            <Txt v="caption" color={colors.gray}>
              Sənin səbətin
            </Txt>
            <Txt v="captionStrong" style={{ marginTop: 4 }}>
              {basket.count} məhsul
            </Txt>
            {lines.length ? (
              <>
                <Price value={o.best?.total ?? 0} size="md" style={{ marginTop: 2 }} />
                {o.best && (
                  <Row gap={6} style={{ marginTop: 6 }}>
                    <StoreAvatar store={o.best.store} size={18} />
                    <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                      {o.best.store.name}-da ən sərfəli
                    </Txt>
                    {o.saving > 0 && <Pill tone="success" text={`${o.saving.toFixed(2)} ₼ qənaət`} />}
                  </Row>
                )}
              </>
            ) : (
              <Txt v="caption" color={colors.primary} style={{ marginTop: 2 }}>
                Məhsul əlavə et →
              </Txt>
            )}
          </View>
          <Txt style={{ fontSize: 48, lineHeight: 56 }}>🛒</Txt>
        </Pressable>

        {/* Categories (from the live catalog) */}
        {categories.length > 0 && (
          <>
            <Txt v="bodyStrong" style={{ marginTop: 19, marginBottom: 9 }}>
              Kateqoriyalar
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {categories.map((c) => (
                <Pressable key={c} onPress={() => setQ(c)} style={({ pressed }) => [styles.category, pressed && { backgroundColor: colors.primarySoft }]}>
                  <Txt v="captionStrong" style={{ fontSize: 12 }}>
                    {c}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        {cat.source === 'supabase' && !cat.loading && cat.products.length === 0 && (
          <View style={[styles.summary, { marginTop: 14 }]}>
            <Txt style={{ fontSize: 28, lineHeight: 34 }}>🗂️</Txt>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Txt v="bodyStrong">Kataloq hələ boşdur</Txt>
              <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                Supabase → products və prices cədvəllərinə məhsul əlavə et.
              </Txt>
            </View>
          </View>
        )}

        {/* AI banner */}
        <Pressable onPress={() => router.push('/assistant')} style={({ pressed }) => [styles.aiBanner, pressed && { opacity: 0.9 }]}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Row gap={8}>
              <Txt v="bodyStrong">Ağıllı alış-veriş</Txt>
              {!basket.isPlus && <PlusTag />}
            </Row>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 12 }}>
              AI köməkçi ilə daha çox qənaət et!
            </Txt>
          </View>
          <View style={styles.aiArrow}>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </View>
        </Pressable>

        {/* Savings teaser — only when the current basket actually saves something */}
        {o.saving > 0 && (
          <Pressable onPress={() => router.push('/savings')} style={({ pressed }) => [styles.savings, pressed && { opacity: 0.9 }]}>
            <View style={{ flex: 1 }}>
              <Txt v="caption" color={colors.gray} style={{ fontSize: 12 }}>
                Bu səbətdə qənaət edirsən
              </Txt>
              <Price value={o.saving} size="md" color={colors.success} />
            </View>
            <Txt v="captionStrong" color={colors.primary}>
              Ətraflı →
            </Txt>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function QuickTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.primarySoft }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Txt v="captionStrong" center style={{ fontSize: 11, marginTop: 6 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    height: 46,
    fontFamily: fonts.regular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  results: { backgroundColor: colors.white, borderRadius: 15, marginTop: 12, overflow: 'hidden', ...shadow.card },
  scanCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  scanSymbol: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tile: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 13,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summary: {
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.white,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  category: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 11 },
  aiBanner: { marginTop: 14, borderRadius: 17, backgroundColor: '#FFF0F0', padding: 14, flexDirection: 'row', alignItems: 'center' },
  aiArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  savings: { marginTop: 12, borderRadius: 17, backgroundColor: colors.successSoft, padding: 14, flexDirection: 'row', alignItems: 'center' },
});
