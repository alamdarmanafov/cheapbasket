import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Chip, Divider, Row, Txt } from '@/components/ui';
import { ProductRow } from '@/components/product';
import { ProductRowSkeleton, StateView } from '@/components/states';
import { SuggestProduct } from '@/components/SuggestProduct';
import { useKeyboardHeight } from '@/lib/keyboard';
import { clearRecents, pushRecent, readRecents, RECENT_SEARCHES } from '@/lib/recents';
import { Product, catalogCategories, categoryEmoji, searchProducts } from '@/data/products';
import { categoryLabel } from '@/data/categoryNames';
import { useCatalog } from '@/store/catalog';
import { useRefresh } from '@/lib/useRefresh';
import { useT } from '@/lib/i18n';
import { track } from '@/lib/track';
import { useBasket } from '@/store/basket';


export default function Search() {
  const kb = useKeyboardHeight();
  const emptyRef = useRef<ScrollView>(null);
  const refresh = useRefresh();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useBasket();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    readRecents(RECENT_SEARCHES).then(setRecent);
  }, []);
  const inputRef = useRef<TextInput>(null);
  const t = useT();

  // Simulated network latency so the loading state is visible in the prototype.
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      const r = searchProducts(q);
      setResults(r);
      setLoading(false);
      if (q.trim().length >= 3) track('search', { q: q.trim().slice(0, 40), results: r.length });
      // Only a search that found something is worth offering again.
      if (q.trim().length >= 2 && r.length > 0) pushRecent(RECENT_SEARCHES, q).then(setRecent);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const { products: allProducts } = useCatalog();
  const showBrowse = !q.trim();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.sm }}>
      <Row gap={space.sm} style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
        <View style={styles.field}>
          <Ionicons name="search" size={20} color={colors.gray} />
          <TextInput
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.grayLight}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel={t('home.clear')}>
              <Ionicons name="close-circle" size={18} color={colors.grayLight} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt v="bodyStrong" color={colors.primary}>
            {t('common.close')}
          </Txt>
        </Pressable>
      </Row>

      {showBrowse ? (
        <FlatList
          refreshControl={refresh.control}
          data={allProducts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: space.lg }}>
              {recent.length > 0 && (
                <>
                  <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
                    <Txt v="captionStrong" color={colors.gray}>
                      {t('search.recent')}
                    </Txt>
                    <Pressable onPress={() => clearRecents(RECENT_SEARCHES).then(() => setRecent([]))} hitSlop={8} accessibilityRole="button">
                      <Txt v="caption" color={colors.grayLight}>
                        {t('common.clear')}
                      </Txt>
                    </Pressable>
                  </Row>
                  <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: space.lg }}>
                    {recent.map((r) => (
                      <Chip key={r} text={`🕘 ${r}`} onPress={() => setQ(r)} />
                    ))}
                  </Row>
                </>
              )}
              {catalogCategories().length > 0 && (
                <>
                  <Txt v="captionStrong" color={colors.gray} style={{ marginBottom: space.sm }}>
                    {t('search.categories')}
                  </Txt>
                  <Row gap={8} style={{ flexWrap: 'wrap' }}>
                    {catalogCategories().map((r) => (
                      // The chip shows the reader's language but still searches the
                      // stored name, which is what products are filed under.
                      <Chip key={r} text={categoryEmoji(r) ? `${categoryEmoji(r)} ${categoryLabel(r)}` : categoryLabel(r)} onPress={() => setQ(r)} />
                    ))}
                  </Row>
                </>
              )}
              <Txt v="captionStrong" color={colors.gray} style={{ marginTop: space.xl, marginBottom: space.sm }}>
                {t('search.allProducts')}{allProducts.length ? ` · ${allProducts.length}` : ''}
              </Txt>
            </View>
          }
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <Divider inset={84} />}
          ListEmptyComponent={<StateView emoji="🗂️" title={t('home.catalogEmpty')} body={t('search.emptyCatalogBody')} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        />
      ) : loading ? (
        <View style={styles.sheet}>
          <ProductRowSkeleton />
          <ProductRowSkeleton />
          <ProductRowSkeleton />
        </View>
      ) : results && results.length > 0 ? (
        <FlatList
          refreshControl={refresh.control}
          data={results}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <Divider inset={84} />}
          ListHeaderComponent={
            <Txt v="caption" color={colors.gray} style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
              {t('search.resultCount', { count: results.length })}
            </Txt>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        /* The suggest box sits under the empty state, low enough for the
           keyboard to cover it: the list scrolls, keeps room for the keyboard
           and brings the box up when its field is tapped. */
        <ScrollView ref={emptyRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: kb + insets.bottom + 90 }}>
          <StateView
            emoji="🔍"
            title={t('home.notFound')}
            body={t('search.noResultBody', { q })}
            cta={t('home.scanBarcode')}
            onCta={() => router.push('/scan')}
            secondary={t('search.clearSearch')}
            onSecondary={() => setQ('')}
            compact
          />
          {/* A search that finds nothing is the other place someone holds a
              product we do not list. The query is the name, prefilled. */}
          <View style={{ paddingHorizontal: space.lg }}>
            <SuggestProduct
              initialName={q}
              title={t('search.suggestTitle')}
              body={t('search.suggestBody', { points: 10 })}
              onDone={() => setQ('')}
              onFocus={() => setTimeout(() => emptyRef.current?.scrollToEnd({ animated: true }), 250)}
            />
          </View>
        </ScrollView>
      )}

      {basket.count > 0 && (
        <Pressable onPress={() => router.push('/basket')} style={[styles.basketBar, { bottom: insets.bottom + space.lg }]}>
          <Ionicons name="basket" size={20} color={colors.white} />
          <Txt v="bodyStrong" color={colors.white} style={{ flex: 1, marginLeft: space.sm }}>
            {t('search.inBasket', { count: basket.count })}
          </Txt>
          <Txt v="bodyStrong" color={colors.white}>
            {t('search.viewBasket')}
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: { flex: 1, marginLeft: space.sm, fontSize: 16, color: colors.dark, height: 48, fontFamily: 'Inter_400Regular', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  sheet: { backgroundColor: colors.white },
  basketBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
});
