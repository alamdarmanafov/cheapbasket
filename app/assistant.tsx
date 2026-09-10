import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';
import { Btn, Chip, Divider, Price, Row, Txt } from '@/components/ui';
import { ProductArt, StoreAvatar } from '@/components/product';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PlusLock } from '@/components/PlusLock';
import { AiCard, AiReply, STARTER_PROMPTS, reply } from '@/lib/assistant';
import { cheapest, getProduct } from '@/data/products';
import { useBasket } from '@/store/basket';
import { useT } from '@/lib/i18n';
import { confirmAsync } from '@/lib/confirm';
import type { Product } from '@/data/products';

interface Msg {
  id: number;
  role: 'user' | 'ai';
  text: string;
  card?: AiCard;
  chips?: string[];
}

export default function Assistant() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const basket = useBasket();
  const t = useT();
  const params = useLocalSearchParams<{ product?: string }>();
  const ctxProduct = params.product ? getProduct(params.product) : undefined;
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: 'ai',
      text: ctxProduct
        ? t('ai.ctxProduct', { product: `${ctxProduct.brand} ${ctxProduct.name}` })
        : t('ai.greeting'),
      chips: ctxProduct ? [t('ai.chipCheaper')] : STARTER_PROMPTS,
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const idRef = useRef(1);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [msgs, typing]);

  const send = (raw: string) => {
    const msg = raw.trim();
    if (!msg || typing) return;
    setInput('');
    setMsgs((m) => [...m, { id: idRef.current++, role: 'user', text: msg }]);
    setTyping(true);
    setTimeout(() => {
      let r: AiReply;
      // The chips are translated, so recognise them by their current label; the
      // Azerbaijani phrasing stays matched for anyone who types it by hand.
      const isAddAll = msg === t('ai.addAll') || /hamısını səbətə/i.test(msg);
      const isFindBest = msg === t('ai.chipFindBest') || /ən sərfəli marketi tap/i.test(msg);
      if (isAddAll) {
        const last = [...msgs].reverse().find((m) => m.card?.kind === 'products');
        if (last?.card?.kind === 'products') last.card.products.forEach((p) => basket.add(p));
        r = { text: last ? t('ai.addedCount', { count: last.card?.kind === 'products' ? last.card.products.length : 0 }) : t('ai.buildFirst'), chips: [t('ai.chipFindBest')] };
      } else if (isFindBest) {
        router.push('/basket?compare=1');
        r = { text: t('ai.opening') };
      } else {
        r = reply(msg, { productId: ctxProduct?.id });
      }
      setMsgs((m) => [...m, { id: idRef.current++, role: 'ai', text: r.text, card: r.card, chips: r.chips }]);
      setTyping(false);
    }, 900);
  };

  /** Adds to the basket and confirms it, offering the basket as the next step. */
  const addToBasket = async (products: Product[]) => {
    if (!products.length) return;
    products.forEach((p) => basket.add(p));
    const go = await confirmAsync(
      t('ai.added'),
      products.length === 1
        ? t('ai.addedOne', { product: `${products[0].brand} ${products[0].name}` })
        : t('ai.addedMany', { count: products.length }),
      t('ai.goBasket'),
      false,
      'Davam et',
    );
    if (go) router.push('/(tabs)/basket');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={t('ai.title')} closeIcon />
      <PlusLock feature={t('ai.subtitle')} minHeight={400} fill>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl }}>
        {msgs.map((m) => (
          <View key={m.id} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <View style={[styles.bubble, m.role === 'user' ? styles.user : styles.ai]}>
              <Txt v="body" color={m.role === 'user' ? colors.white : colors.dark}>
                {m.text}
              </Txt>
            </View>
            {m.card && <CardView card={m.card} onAddAll={addToBasket} onAdd={(p) => addToBasket([p])} />}
            {m.chips && m.role === 'ai' && (
              <Row gap={8} style={{ flexWrap: 'wrap', marginTop: space.sm, maxWidth: '92%' }}>
                {m.chips.map((c) => (
                  <Chip key={c} text={c} onPress={() => send(c)} />
                ))}
              </Row>
            )}
          </View>
        ))}
        {typing && (
          <View style={[styles.bubble, styles.ai, { flexDirection: 'row', gap: 4 }]}>
            <Dot />
            <Dot delay={150} />
            <Dot delay={300} />
          </View>
        )}
      </ScrollView>
      <Row gap={space.sm} style={[styles.inputBar, { paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('ai.placeholder')}
          placeholderTextColor={colors.grayLight}
          style={styles.input}
          onSubmitEditing={() => send(input)}
          returnKeyType="send"
        />
        <Pressable onPress={() => send(input)} style={[styles.send, !input.trim() && { opacity: 0.4 }]} accessibilityLabel={t('ai.send')}>
          <Ionicons name="arrow-up" size={20} color={colors.white} />
        </Pressable>
      </Row>
      </PlusLock>
    </KeyboardAvoidingView>
  );
}

function CardView({ card, onAddAll, onAdd }: { card: AiCard; onAddAll: (p: AiCard extends { products: infer P } ? P : never) => void; onAdd: (p: AiCard['products'][number]) => void }) {
  const t = useT();
  const router = useRouter();
  const baseCheapest = card.kind === 'alternatives' ? (cheapest(card.base).price ?? 0) : 0;
  return (
    <View style={styles.card}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.sm }}>
        <Txt v="bodyStrong">{card.title}</Txt>
        {card.kind === 'products' && card.total != null && (
          <Txt v="captionStrong" color={colors.success} num>
            {card.total.toFixed(2)} ₼{card.budget ? ` / ${card.budget} ₼` : ''}
          </Txt>
        )}
      </Row>
      {card.products.map((p, i) => {
        const c = cheapest(p);
        const diff = card.kind === 'alternatives' && c.price != null ? c.price - baseCheapest : null;
        return (
          <React.Fragment key={p.id}>
            {i > 0 && <Divider />}
            <Pressable onPress={() => router.push(`/product/${p.id}`)} style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <ProductArt product={p} size={40} />
              <View style={{ flex: 1 }}>
                <Txt v="body" numberOfLines={1}>
                  {p.brand} {p.name}
                </Txt>
                <Row gap={6}>
                  <StoreAvatar store={c.store} size={14} />
                  <Txt v="caption" color={colors.gray}>
                    {c.store.name} · {p.size}
                    {p.rating ? ` · ★ ${p.rating.toFixed(1)}` : ''}
                  </Txt>
                </Row>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                {c.price != null && <Price value={c.price} size="sm" />}
                {diff != null && (
                  <Txt v="caption" color={diff < 0 ? colors.success : colors.gray} num>
                    {diff < 0 ? '−' : '+'}{Math.abs(diff).toFixed(2)} ₼
                  </Txt>
                )}
              </View>
              <Pressable onPress={() => onAdd(p)} hitSlop={8} style={styles.miniAdd} accessibilityLabel={t('ai.addToBasket')}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </Pressable>
            </Pressable>
          </React.Fragment>
        );
      })}
      {card.kind === 'products' && (
        <Btn title={t('ai.addAll')} size="md" icon="basket" onPress={() => onAddAll(card.products)} style={{ marginTop: space.sm }} />
      )}
    </View>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const i = setInterval(() => setOn((v) => !v), 400 + delay);
    return () => clearInterval(i);
  }, [delay]);
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? colors.gray : colors.line }} />;
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  user: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  ai: { backgroundColor: colors.white, borderBottomLeftRadius: 6, ...shadow.card },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, marginTop: space.sm, width: '100%', ...shadow.card },
  miniAdd: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  inputBar: { paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, height: 48, borderRadius: radius.pill, backgroundColor: colors.fill, paddingHorizontal: space.lg, fontSize: 16, color: colors.dark, fontFamily: 'Inter_400Regular', ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
