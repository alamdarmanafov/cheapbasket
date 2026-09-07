import { track } from '@/lib/track';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';
import { useCatalog } from './catalog';
import { supabase } from '@/lib/supabase';
import { Product, StoreId } from '@/data/products';
import { PlanId } from '@/data/plans';
import { BasketLine, optimize, Optimization } from '@/lib/optimizer';

interface BasketState {
  lines: BasketLine[];
  count: number;
  add: (p: Product, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  has: (id: string) => boolean;
  /** Raw saved form (product id + qty), e.g. for saved lists. */
  entries: Array<{ id: string; qty: number }>;
  /** Replace the whole basket (loading a saved list). */
  replace: (entries: Array<{ id: string; qty: number }>) => void;
  optimization: Optimization;
  /** Store the user picked on the result screen (defaults to the AI's best). */
  chosenStore: StoreId | null;
  setChosenStore: (s: StoreId | null) => void;
  /** Subscription plan (simulated purchase in the prototype). */
  plan: PlanId;
  isPlus: boolean;
  setPlan: (p: PlanId) => void;
}

const BasketCtx = createContext<BasketState | null>(null);


type Entry = { id: string; qty: number };
const KEY = 'cb_basket';

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [chosenStore, setChosenStore] = useState<StoreId | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');
  const auth = useAuth();
  const cat = useCatalog();
  const userId = auth.user?.id ?? null;
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (auth.profile) setPlan(auth.profile.plan);
  }, [auth.profile]);

  // 1. Local persistence: the basket survives reloads and restarts.
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setEntries(JSON.parse(raw) as Entry[]);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);
  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => undefined);
  }, [entries, hydrated]);

  // 2. Cloud sync for signed-in users (the digest and price-drop pushes read these tables).
  useEffect(() => {
    if (!supabase || !userId || !hydrated) return;
    const db = supabase;
    let cancelled = false;
    (async () => {
      const { data: basket } = await db.from('baskets').select('id').eq('user_id', userId).order('created_at').limit(1).maybeSingle();
      let basketId = basket?.id as string | undefined;
      if (!basketId) {
        const { data: created } = await db.from('baskets').insert({ user_id: userId }).select('id').single();
        basketId = created?.id;
      }
      if (!basketId || cancelled) return;
      if (syncedFor.current !== userId) {
        // First sync after login: merge what the server has into the local basket.
        const { data: items } = await db.from('basket_items').select('product_id, qty').eq('basket_id', basketId);
        syncedFor.current = userId;
        if (items?.length) {
          setEntries((local) => {
            const map = new Map(local.map((e) => [e.id, e.qty]));
            for (const it of items) if (!map.has(it.product_id)) map.set(it.product_id, it.qty);
            return [...map.entries()].map(([id, qty]) => ({ id, qty }));
          });
          return; // the state change re-runs this effect and writes the merged basket
        }
      }
      await db.from('basket_items').delete().eq('basket_id', basketId);
      if (entries.length) await db.from('basket_items').insert(entries.map((e) => ({ basket_id: basketId, product_id: e.id, qty: e.qty })));
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [entries, userId, hydrated]);
  useEffect(() => {
    if (!userId) syncedFor.current = null;
  }, [userId]);

  // 3. Lines always carry the live product (prices refresh with the catalogue); unknown ids are kept until the catalogue loads.
  const lines = useMemo<BasketLine[]>(() => {
    const byId = new Map(cat.products.map((p) => [p.id, p]));
    return entries.map((e) => ({ product: byId.get(e.id), qty: e.qty })).filter((l): l is BasketLine => !!l.product);
  }, [entries, cat.products]);

  const add = useCallback((p: Product, qty = 1) => {
    track('basket_add', { product_id: p.id });
    setEntries((es) => {
      const i = es.findIndex((e) => e.id === p.id);
      if (i >= 0) {
        const next = [...es];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...es, { id: p.id, qty }];
    });
  }, []);

  const remove = useCallback((id: string) => setEntries((es) => es.filter((e) => e.id !== id)), []);

  const setQty = useCallback((id: string, qty: number) => {
    setEntries((es) => (qty <= 0 ? es.filter((e) => e.id !== id) : es.map((e) => (e.id === id ? { ...e, qty } : e))));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const optimization = useMemo(() => optimize(lines), [lines]);

  const value = useMemo<BasketState>(
    () => ({
      lines,
      count: lines.reduce((a, l) => a + l.qty, 0),
      add,
      remove,
      setQty,
      clear,
      has: (id) => entries.some((e) => e.id === id),
      entries,
      replace: (next) => setEntries(next.map((e) => ({ id: e.id, qty: Math.max(1, e.qty) }))),
      optimization,
      chosenStore,
      setChosenStore,
      plan,
      isPlus: plan === 'plus',
      setPlan,
    }),
    [lines, entries, add, remove, setQty, clear, optimization, chosenStore, plan],
  );

  return <BasketCtx.Provider value={value}>{children}</BasketCtx.Provider>;
}

export function useBasket(): BasketState {
  const ctx = useContext(BasketCtx);
  if (!ctx) throw new Error('useBasket must be used inside BasketProvider');
  return ctx;
}
