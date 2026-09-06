import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme';
import { Chip, Divider, Row, Txt } from '@/components/ui';
import { ProductRow } from '@/components/product';
import { ProductRowSkeleton, StateView } from '@/components/states';
import { POPULAR_SEARCHES, Product, searchProducts } from '@/data/products';
import { useCatalog } from '@/store/catalog';
import { useBasket } from '@/store/basket';

const RECENT = ['Sütaş süd', 'Nescafé', 'Toyuq filesi'];

export default function Search() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useBasket();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Product[] | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Simulated network latency so the loading state is visible in the prototype.
  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      setResults(searchProducts(q));
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
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
            placeholder="Məhsul axtar..."
            placeholderTextColor={colors.grayLight}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Təmizlə">
              <Ionicons name="close-circle" size={18} color={colors.grayLight} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Txt v="bodyStrong" color={colors.primary}>
            Bağla
          </Txt>
        </Pressable>
      </Row>

      {showBrowse ? (
        <FlatList
          data={allProducts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: space.lg }}>
              <Txt v="captionStrong" color={colors.gray} style={{ marginBottom: space.sm }}>
                SON AXTARIŞLAR
              </Txt>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {RECENT.map((r) => (
                  <Chip key={r} text={r} onPress={() => setQ(r)} />
                ))}
              </Row>
              <Txt v="captionStrong" color={colors.gray} style={{ marginTop: space.xl, marginBottom: space.sm }}>
                POPULYAR
              </Txt>
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {POPULAR_SEARCHES.map((r) => (
                  <Chip key={r} text={r} onPress={() => setQ(r)} />
                ))}
              </Row>
              <Txt v="captionStrong" color={colors.gray} style={{ marginTop: space.xl, marginBottom: space.sm }}>
                BÜTÜN MƏHSULLAR
              </Txt>
            </View>
          }
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <Divider inset={84} />}
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
          data={results}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductRow product={item} />}
          ItemSeparatorComponent={() => <Divider inset={84} />}
          ListHeaderComponent={
            <Txt v="caption" color={colors.gray} style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
              {results.length} nəticə
            </Txt>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <StateView
          emoji="🔍"
          title="Məhsul tapılmadı"
          body={`“${q}” üzrə nəticə yoxdur. Adı fərqli yaz və ya barkodu skan et.`}
          cta="Barkodu skan et"
          onCta={() => router.push('/scan')}
          secondary="Axtarışı təmizlə"
          onSecondary={() => setQ('')}
        />
      )}

      {basket.count > 0 && (
        <Pressable onPress={() => router.push('/basket')} style={[styles.basketBar, { bottom: insets.bottom + space.lg }]}>
          <Ionicons name="basket" size={20} color={colors.white} />
          <Txt v="bodyStrong" color={colors.white} style={{ flex: 1, marginLeft: space.sm }}>
            Səbətdə {basket.count} məhsul
          </Txt>
          <Txt v="bodyStrong" color={colors.white}>
            Səbətə bax →
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
