import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getProduct, Product, StoreId } from '@/data/products';
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

/** Seed basket so the prototype opens with a realistic state. */
const SEED: Array<[string, number]> = [
  ['sutas-sud-1l', 1],
  ['yumurta-10', 1],
  ['toyuq-file-1kg', 1],
  ['duyu-1kg', 1],
  ['zeytun-yagi-500', 1],
  ['nescafe-gold-95', 1],
  ['pendir-atena-400', 1],
  ['corek-tandir', 1],
  ['sire-portagal-1l', 1],
  ['sampun-400', 1],
];

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BasketLine[]>(() =>
    SEED.flatMap(([id, qty]) => {
      const product = getProduct(id);
      return product ? [{ product, qty }] : [];
    }),
  );
  const [chosenStore, setChosenStore] = useState<StoreId | null>(null);
  const [plan, setPlan] = useState<PlanId>('free');

  const add = useCallback((p: Product, qty = 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id);
      if (i >= 0) {
        const next = [...ls];
        next[i] = { ...next[i], qty: next[i].qty + qty };
        return next;
      }
      return [...ls, { product: p, qty }];
    });
  }, []);

  const remove = useCallback((id: string) => setLines((ls) => ls.filter((l) => l.product.id !== id)), []);

  const setQty = useCallback((id: string, qty: number) => {
    setLines((ls) =>
      qty <= 0 ? ls.filter((l) => l.product.id !== id) : ls.map((l) => (l.product.id === id ? { ...l, qty } : l)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const optimization = useMemo(() => optimize(lines), [lines]);

  const value = useMemo<BasketState>(
    () => ({
      lines,
      count: lines.reduce((a, l) => a + l.qty, 0),
      add,
      remove,
      setQty,
      clear,
      has: (id) => lines.some((l) => l.product.id === id),
      optimization,
      chosenStore,
      setChosenStore,
      plan,
      isPlus: plan === 'plus',
      setPlan,
    }),
    [lines, add, remove, setQty, clear, optimization, chosenStore, plan],
  );

  return <BasketCtx.Provider value={value}>{children}</BasketCtx.Provider>;
}

export function useBasket(): BasketState {
  const ctx = useContext(BasketCtx);
  if (!ctx) throw new Error('useBasket must be used inside BasketProvider');
  return ctx;
}
