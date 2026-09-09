import React, { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts, radius, shadow, space } from '@/theme';
import { Btn, Card, Divider, Price, Row, Txt } from '@/components/ui';
import { ProductRow, StoreAvatar } from '@/components/product';
import { ProductRowSkeleton } from '@/components/states';
import { TopBar } from '@/components/TopBar';
import { BannerSlider } from '@/components/BannerSlider';
import { PlusTag } from '@/components/PlusLock';
import { Product, catalogCategories, categoryEmoji, searchProducts } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { openStoreBranches } from '@/lib/maps';
import { useRefresh } from '@/lib/useRefresh';
import { useBasket } from '@/store/basket';
import { useT } from '@/lib/i18n';


export default function Home() {
  const router = useRouter();
  const basket = useBasket();
  const { optimization: o } = basket;
  const cat = useCatalog();
  const refresh = useRefresh();
  const t = useT();
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
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled" refreshControl={refresh.control}>
        <Txt v="display" style={{ marginTop: space.xs }}>
          {t('home.title1')}{'\n'}
          <Txt v="display" color={colors.primary}>
            {t('home.title2')}
          </Txt>
        </Txt>
        <Txt v="caption" color={colors.gray} style={{ marginTop: space.sm, marginBottom: space.lg }}>
          {t('home.subtitle')}
        </Txt>

        {/* Search */}
        <Row style={styles.search} gap={space.sm}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.grayLight}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel={t('home.clear')}>
              <Ionicons name="close-circle" size={18} color={colors.grayLight} />
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/scan')} hitSlop={8} accessibilityLabel={t('home.scanBarcode')}>
              <Ionicons name="barcode-outline" size={20} color={colors.dark} />
            </Pressable>
          )}
        </Row>

        {/* Inline results */}
        {q.trim() !== '' && (
          <View style={styles.results}>
            <Txt v="bodyStrong" style={{ paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs }}>
              {t('home.results')}
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
                  {t('home.notFound')}
                </Txt>
                <Txt v="caption" color={colors.gray} center style={{ marginTop: 4 }}>
                  {t('home.notFoundBody')}
                </Txt>
                <Btn title={t('home.scanBarcode')} size="md" full={false} icon="barcode-outline" onPress={() => router.push('/scan')} style={{ marginTop: space.md }} />
              </View>
            )}
          </View>
        )}

        {/* Promo banners (admin-managed slider) */}
        <BannerSlider banners={cat.banners} />

        {/* Stores (live from admin) */}
        {cat.stores.length > 0 && (
          <>
            <Row style={{ justifyContent: 'space-between', marginTop: 19, marginBottom: 9 }}>
              <Txt v="bodyStrong">{t('home.stores')}</Txt>
              <Pressable onPress={() => router.push('/nearby')} hitSlop={8} accessibilityRole="button">
                <Txt v="captionStrong" color={colors.primary}>
                  {t('home.nearby')}
                </Txt>
              </Pressable>
            </Row>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {cat.stores.map((s) => (
                <Pressable key={s.id} onPress={() => openStoreBranches(s.name, cat.location)} style={({ pressed }) => [styles.storeChip, pressed && { backgroundColor: colors.primarySoft }]}>
                  <StoreAvatar store={s} size={22} />
                  <Txt v="captionStrong" style={{ fontSize: 12, marginLeft: 6 }}>
                    {s.name}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {/* Categories (from the live catalog) */}
        {categories.length > 0 && (
          <>
            <Txt v="bodyStrong" style={{ marginTop: 19, marginBottom: 9 }}>
              {t('home.categories')}
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
              {categories.map((c) => (
                <Pressable key={c} onPress={() => setQ(c)} style={({ pressed }) => [styles.category, pressed && { backgroundColor: colors.primarySoft }]}>
                  <Txt v="captionStrong" style={{ fontSize: 12 }}>
                    {categoryEmoji(c) ? `${categoryEmoji(c)} ` : ''}
                    {c}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
        {!cat.loading && cat.products.length === 0 && (
          <View style={[styles.summary, { marginTop: 14 }]}>
            <Txt style={{ fontSize: 28, lineHeight: 34 }}>🗂️</Txt>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Txt v="bodyStrong">{t(cat.error ? 'home.catalogFailed' : 'home.catalogEmpty')}</Txt>
              <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
                {cat.error ?? t('home.catalogEmptyBody')}
              </Txt>
            </View>
          </View>
        )}

        {/* Deals */}
        <Pressable onPress={() => router.push('/deals')} style={({ pressed }) => [styles.summary, { marginTop: 14 }, pressed && { opacity: 0.9 }]}>
          <Txt style={{ fontSize: 28, lineHeight: 34 }}>🔻</Txt>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Txt v="bodyStrong">{t('home.deals')}</Txt>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 11 }}>
              {t('home.dealsBody', { when: t(basket.isPlus ? 'home.dealsDaily' : 'home.dealsPlus') })}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.grayLight} />
        </Pressable>

        {/* AI banner */}
        <Pressable onPress={() => router.push('/assistant')} style={({ pressed }) => [styles.aiBanner, pressed && { opacity: 0.9 }]}>
          <Ionicons name="sparkles" size={22} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Row gap={8}>
              <Txt v="bodyStrong">{t('home.aiTitle')}</Txt>
              {!basket.isPlus && <PlusTag />}
            </Row>
            <Txt v="caption" color={colors.gray} style={{ fontSize: 12 }}>
              {t('home.aiBody')}
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
                {t('profile.savingNow')}
              </Txt>
              <Price value={o.saving} size="md" color={colors.success} />
            </View>
            <Txt v="captionStrong" color={colors.primary}>
              {t('profile.more')}
            </Txt>
          </Pressable>
        )}
      </ScrollView>
    </View>
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
  summary: {
    marginTop: 12,
    borderRadius: 17,
    backgroundColor: colors.white,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.card,
  },
  storeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingVertical: 8, paddingHorizontal: 10 },
  category: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 13, paddingVertical: 10, paddingHorizontal: 11 },
  aiBanner: { marginTop: 14, borderRadius: 17, backgroundColor: '#FFF0F0', padding: 14, flexDirection: 'row', alignItems: 'center' },
  aiArrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  savings: { marginTop: 12, borderRadius: 17, backgroundColor: colors.successSoft, padding: 14, flexDirection: 'row', alignItems: 'center' },
});
